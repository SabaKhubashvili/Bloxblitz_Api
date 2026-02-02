import { Module } from '@nestjs/common';
import { BalanceModule } from './balance/balance.module';
import { BetHistoryModule } from './bet-history/bet-history.module';
import { ProfileModule } from './profile/profile.module';
import { TransactionHistoryModule } from './transaction-history/transaction-history.module';

@Module({
  imports: [BalanceModule, BetHistoryModule,TransactionHistoryModule, ProfileModule],
})
export class UserModule {}
