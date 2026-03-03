import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { RedisService } from '../cache/redis.service.js';
import { RedisKeys } from '../cache/redis.keys.js';
import { AccumulateRakebackUseCase } from '../../application/user/rakeback/use-cases/accumulate-rakeback.use-case.js';

const POLL_INTERVAL_MS = 500;
const BATCH_SIZE = 50;
const IDEMPOTENCY_TTL = 86_400; // 24 h

@Injectable()
export class RakebackAccumulationWorker {
  private readonly logger = new Logger(RakebackAccumulationWorker.name);
  private isProcessing = false;

  constructor(
    private readonly redis: RedisService,
    private readonly accumulateUseCase: AccumulateRakebackUseCase,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async poll(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      let processed = 0;

      for (let i = 0; i < BATCH_SIZE; i++) {
        const raw = await this.redis.rpop(RedisKeys.queue.rakebackWagers());
        if (!raw) break;

        try {
          const event = JSON.parse(raw) as {
            username: string;
            betAmount: number;
            gameType: string;
            gameId: string;
          };

          const idempotencyKey = `rakeback:processed:${event.gameId}`;
          if (await this.redis.exists(idempotencyKey)) continue;

          const userLevel = await this.resolveUserLevel(event.username);

          await this.accumulateUseCase.execute({
            username: event.username,
            wagerAmount: event.betAmount,
            gameType: event.gameType,
            gameId: event.gameId,
            userLevel,
          });

          await this.redis.set(idempotencyKey, '1', IDEMPOTENCY_TTL);
          processed++;
        } catch (err) {
          this.logger.error('Failed to process rakeback event', err);
        }
      }

      if (processed > 0) {
        this.logger.debug(`Processed ${processed} rakeback event(s)`);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /** Fast Redis-first lookup; falls back to level 1 if cache is cold. */
  private async resolveUserLevel(username: string): Promise<number> {
    try {
      const cached = await this.redis.get<{ currentLevel?: number }>(
        RedisKeys.leveling.userInfo(username),
      );
      if (cached && typeof cached.currentLevel === 'number') {
        return cached.currentLevel;
      }
    } catch {
      // Redis miss is non-critical — fall through to default
    }
    return 1;
  }
}
