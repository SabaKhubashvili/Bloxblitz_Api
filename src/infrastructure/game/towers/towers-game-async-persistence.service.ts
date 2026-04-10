import { Injectable, Logger } from '@nestjs/common';
import { GameStatus } from '@prisma/client';
import { RedisKeys } from '../../cache/redis.keys';
import { RedisService } from '../../cache/redis.service';
import {
  TowersGameRepository,
  type UpdateTowersGameParams,
} from '../../persistance/repositories/game/towers-game.repository';
import { TowersGameCacheMetricsService } from './towers-game-cache-metrics.service';

const MAX_RETRIES = 4;
const DLQ_CAP = 500;

type MidJob = {
  kind: 'mid';
  towersRowId: string;
  patch: UpdateTowersGameParams;
};

type TerminalJob = {
  kind: 'terminal';
  towersRowId: string;
  gameHistoryId: string;
  username: string;
  towersPatch: UpdateTowersGameParams;
  parentStatus: GameStatus;
  netProfit: number;
  finalMultiplier: number;
};

export type TowersPersistJob = MidJob | TerminalJob;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

@Injectable()
export class TowersGameAsyncPersistenceService {
  private readonly logger = new Logger(TowersGameAsyncPersistenceService.name);

  constructor(
    private readonly repo: TowersGameRepository,
    private readonly redis: RedisService,
    private readonly metrics: TowersGameCacheMetricsService,
  ) {}

  scheduleMidGame(towersRowId: string, patch: UpdateTowersGameParams): void {
    const job: MidJob = { kind: 'mid', towersRowId, patch };
    setImmediate(() => void this.runWithRetry(job, 1));
  }

  scheduleTerminal(job: Omit<TerminalJob, 'kind'>): void {
    const full: TerminalJob = { kind: 'terminal', ...job };
    setImmediate(() => void this.runWithRetry(full, 1));
  }

  private async runWithRetry(job: TowersPersistJob, attempt: number): Promise<void> {
    try {
      if (job.kind === 'mid') {
        await this.repo.persistMidGameState(job.towersRowId, job.patch);
      } else {
        await this.repo.persistTerminalState({
          towersRowId: job.towersRowId,
          gameHistoryId: job.gameHistoryId,
          username: job.username,
          towersPatch: job.towersPatch,
          parentStatus: job.parentStatus,
          netProfit: job.netProfit,
          finalMultiplier: job.finalMultiplier,
        });
      }
      this.metrics.recordPersistOk();
    } catch (err) {
      this.logger.error(`[towers.persist] attempt ${attempt} failed`, {
        job,
        err,
      });
      if (attempt < MAX_RETRIES) {
        await delay(40 * 2 ** (attempt - 1));
        return this.runWithRetry(job, attempt + 1);
      }
      this.metrics.recordPersistFail();
      await this.pushDlq(job, err);
    }
  }

  private async pushDlq(job: TowersPersistJob, err: unknown): Promise<void> {
    try {
      const payload = JSON.stringify({
        job,
        error: err instanceof Error ? err.message : String(err),
        at: new Date().toISOString(),
      });
      await this.redis.lpush(RedisKeys.towers.persistDlq(), payload);
      await this.redis.mainClient.lTrim(RedisKeys.towers.persistDlq(), 0, DLQ_CAP - 1);
      this.metrics.recordDlq();
      this.logger.error('[towers.persist] moved to DLQ after retries', {
        job,
      });
    } catch (dlqErr) {
      this.logger.error('[towers.persist] DLQ push failed', dlqErr);
    }
  }
}
