import { Injectable, Logger } from '@nestjs/common';
import {
  IBetEventPublisherPort,
  BetPlacedEvent,
} from '../../../application/game/mines/ports/bet-event-publisher.port';
import { RedisService } from '../../cache/redis.service';
import { RedisKeys } from '../../cache/redis.keys';

const BET_PLACED_CHANNEL = 'events:bet:placed';

@Injectable()
export class BetEventPublisher implements IBetEventPublisherPort {
  private readonly logger = new Logger(BetEventPublisher.name);

  constructor(private readonly redis: RedisService) {}

  async publishBetPlaced(event: BetPlacedEvent): Promise<void> {
    const payload = JSON.stringify(event);
    this.logger.log(`Publishing bet placed event: ${payload}`); 
    try {
      await Promise.all([
        this.redis.pubClient.publish(BET_PLACED_CHANNEL, payload),
        this.redis.lpush(RedisKeys.queue.rakebackWagers(), payload),
      ]);
    } catch (err) {
      this.logger.error('Failed to publish bet placed event', err);
    }
  }
}
