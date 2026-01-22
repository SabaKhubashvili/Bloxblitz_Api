import { Module } from '@nestjs/common';
import { PrivateUserModule } from './user/privateUser.module';
import { PrivateProvablyFairModule } from './user/provably-fair/private-provably-fair.module';
import { PrivateUserInventoryModule } from './user/inventory/privateUserInventory.module';
import { BetHistoryModule } from './user/bet-history/private-bet-history.module';
import { PrivateBalanceModule } from './user/balance/private-balance.module';
import { PrivateUserStatisticsModule } from './user/statistics/PrivateUserStatistics.module';

@Module({
  imports: [
    PrivateUserModule,
    PrivateProvablyFairModule,
    PrivateUserInventoryModule,
    BetHistoryModule,
    PrivateBalanceModule,
    PrivateUserStatisticsModule
  ],
})
export class PrivateModule {}
