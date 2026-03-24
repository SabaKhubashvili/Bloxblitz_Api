import { Injectable, Logger } from '@nestjs/common';
import {
  IBetEventPublisherPort,
  BetPlacedEvent,
} from '../../../application/game/mines/ports/bet-event-publisher.port';
import { RedisService } from '../../cache/redis.service';
import { RedisKeys } from '../../cache/redis.keys';

const BET_PLACED_CHANNEL = 'events:bet:placed';

/** Shape consumed by `RakebackAccumulationWorker`. */
function buildRakebackQueuePayload(event: BetPlacedEvent): string | null {
  const gameId = event.gameId;
  const betAmount = event.amount;
  const gameType = event.game;
  const isLost = event.returnedAmount === 0;
  if (!gameId || gameId.length === 0) return null;
  if (!Number.isFinite(betAmount) || betAmount <= 0) return null;
  if (!gameType) return null;
  if (!isLost) return null;
  const returnedAmount =
    typeof event.returnedAmount === 'number' && Number.isFinite(event.returnedAmount)
      ? Math.max(0, event.returnedAmount)
      : 0;

  return JSON.stringify({
    username: event.username,
    betAmount,
    returnedAmount,
    gameType,
    gameId,
  });
}

@Injectable()
export class BetEventPublisher implements IBetEventPublisherPort {
  private readonly logger = new Logger(BetEventPublisher.name);

  constructor(private readonly redis: RedisService) {}

  async publishBetPlaced(event: BetPlacedEvent): Promise<void> {
    const pubPayload = JSON.stringify(event);
    const rakebackPayload = buildRakebackQueuePayload(event);
    this.logger.log(`Publishing bet placed event: ${pubPayload}`);
    try {
      this.logger.log(`Publishing rakeback queue payload: ${rakebackPayload}`);
      const ops: Promise<unknown>[] = [
        this.redis.pubClient.publish(BET_PLACED_CHANNEL, pubPayload),
      ];
      if (rakebackPayload) {
        ops.push(this.redis.lpush(RedisKeys.queue.rakebackWagers(), rakebackPayload));
      } else {
        this.logger.warn(
          `Skipping rakeback queue (need gameId, amount>0, game): user=${event.username} game=${event.game}`,
        );
      }
      await Promise.all(ops);
    } catch (err) {
      this.logger.error('Failed to publish bet placed event', err);
    }
  }
}
