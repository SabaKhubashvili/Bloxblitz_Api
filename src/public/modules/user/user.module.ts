import { Module } from '@nestjs/common';
import { BalanceModule } from './balance/balance.module';
import { BetHistoryModule } from './bet-history/bet-history.module';
import { ProfileModule } from './profile/profile.module';
import { TransactionHistoryModule } from './transaction-history/transaction-history.module';
import { RakebackModule } from './rakeback/rakeback.module';

@Module({
  imports: [BalanceModule, BetHistoryModule,TransactionHistoryModule, ProfileModule,RakebackModule],
})
export class UserModule {}
