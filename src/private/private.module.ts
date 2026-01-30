import { Module } from '@nestjs/common';
import { PrivateUserModule } from './modules/user/privateUser.module';
import { PrivateProvablyFairModule } from './modules/user/provably-fair/private-provably-fair.module';
import { PrivateUserInventoryModule } from './modules/user/inventory/privateUserInventory.module';
import { BetHistoryModule } from './modules/user/bet-history/private-bet-history.module';
import { PrivateBalanceModule } from './modules/user/balance/private-balance.module';
import { PrivateUserStatisticsModule } from './modules/user/statistics/PrivateUserStatistics.module';
import { PrivateGamesModule } from './modules/games/PrivateGames.module';

@Module({
  imports: [
    PrivateUserModule,
    PrivateProvablyFairModule,
    PrivateUserInventoryModule,
    BetHistoryModule,
    PrivateBalanceModule,
    PrivateUserStatisticsModule,

    PrivateGamesModule
  ],
})
export class PrivateModule {}
