import { Global, Module } from '@nestjs/common';
import { BumpUserGameStatisticsUseCase } from './bump-user-game-statistics.use-case';
import { BumpGlobalUserStatisticsUseCase } from './bump-global-user-statistics.use-case';

@Global()
@Module({
  providers: [BumpUserGameStatisticsUseCase, BumpGlobalUserStatisticsUseCase],
  exports: [BumpUserGameStatisticsUseCase, BumpGlobalUserStatisticsUseCase],
})
export class UserStatisticsBumpModule {}
