import { Module } from '@nestjs/common';
import { BetEventPublisher } from './bet-event.publisher';

@Module({
  providers: [BetEventPublisher],
  exports: [BetEventPublisher],
})
export class RedisPubSubModule {}
