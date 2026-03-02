import { Injectable, Logger } from '@nestjs/common';
import {
  IBetEventPublisherPort,
  BetPlacedEvent,
} from '../../../application/game/mines/ports/bet-event-publisher.port.js';
import { RedisService } from '../../cache/redis.service.js';

const BET_PLACED_CHANNEL = 'events:bet:placed';

@Injectable()
export class BetEventPublisher implements IBetEventPublisherPort {
  private readonly logger = new Logger(BetEventPublisher.name);

  constructor(private readonly redis: RedisService) {}

  async publishBetPlaced(event: BetPlacedEvent): Promise<void> {
    try {
      await this.redis.pubClient.publish(BET_PLACED_CHANNEL, JSON.stringify(event));
    } catch (err) {
      this.logger.error('Failed to publish bet placed event', err);
    }
  }
}
