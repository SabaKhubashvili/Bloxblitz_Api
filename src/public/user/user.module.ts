import { Module } from '@nestjs/common';
import { BalanceModule } from './balance/balance.module';
import { BetHistoryModule } from './bet-history/bet-history.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [BalanceModule, BetHistoryModule, ProfileModule],
})
export class UserModule {}
