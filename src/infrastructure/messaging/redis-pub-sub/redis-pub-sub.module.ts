import { Module } from '@nestjs/common';
import { BetEventPublisher } from './bet-event.publisher.js';

@Module({
  providers: [BetEventPublisher],
  exports: [BetEventPublisher],
})
export class RedisPubSubModule {}
