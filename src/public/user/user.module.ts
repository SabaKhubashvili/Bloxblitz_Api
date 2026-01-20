import { Module } from '@nestjs/common';
import { BalanceModule } from './balance/balance.module';
import { BetHistoryModule } from './bet-history/bet-history.module';

@Module({
  imports: [BalanceModule, BetHistoryModule],
})
export class UserModule {}
