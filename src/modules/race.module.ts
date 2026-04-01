import { Module } from '@nestjs/common';

import { AuthModule } from './auth.module';
import { PrismaModule } from '../infrastructure/persistance/prisma/prisma.module';

import { PrismaRaceRepository } from '../infrastructure/persistance/repositories/race/prisma-race.repository';
import { RaceCacheAdapter } from '../infrastructure/cache/adapters/race-cache.adapter';

import { GetCurrentRaceUseCase } from '../application/race/use-cases/get-current-race.use-case';
import { GetPreviousRacesUseCase } from '../application/race/use-cases/get-previous-races.use-case';
import { GetLeaderboardUseCase } from '../application/race/use-cases/get-leaderboard.use-case';
import { GetUserRankUseCase } from '../application/race/use-cases/get-user-rank.use-case';
import { UpdateUserWagerInRaceUseCase } from '../application/race/use-cases/update-user-wager-in-race.use-case';
import { UpdateWagerOnActiveRaceUseCase } from '../application/race/use-cases/update-wager-on-active-race.use-case';
import { IncrementRaceWagerUseCase } from '../application/race/use-cases/increment-race-wager.use-case';
import { RaceWagerSignalsService } from '../application/race/services/race-wager-signals.service';
import { RaceLeaderboardRefreshWorker } from '../infrastructure/workers/race-leaderboard-refresh.worker';
import { RaceLifecycleWorker } from '../infrastructure/workers/race-lifecycle.worker';
import { RaceLeaderboardZsetService } from '../infrastructure/cache/race-leaderboard-zset.service';
import { FinishRaceUseCase } from '../application/race/use-cases/finish-race.use-case';
import { CreateRaceWithRewardsUseCase } from '../application/race/use-cases/create-race-with-rewards.use-case';

import { RACE_CACHE, RACE_REPOSITORY } from '../application/race/tokens/race.tokens';

import { RaceController } from '../presentation/http/public/race/race.controller';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../shared/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../shared/guards/roles.guard';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [RaceController],
  providers: [
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
    { provide: RACE_REPOSITORY, useClass: PrismaRaceRepository },
    { provide: RACE_CACHE, useClass: RaceCacheAdapter },
    GetCurrentRaceUseCase,
    GetPreviousRacesUseCase,
    GetLeaderboardUseCase,
    GetUserRankUseCase,
    RaceLeaderboardZsetService,
    UpdateUserWagerInRaceUseCase,
    RaceWagerSignalsService,
    IncrementRaceWagerUseCase,
    UpdateWagerOnActiveRaceUseCase,
    RaceLeaderboardRefreshWorker,
    RaceLifecycleWorker,
    FinishRaceUseCase,
    CreateRaceWithRewardsUseCase,
  ],
  exports: [
    RACE_REPOSITORY,
    RACE_CACHE,
    GetLeaderboardUseCase,
    GetUserRankUseCase,
    UpdateUserWagerInRaceUseCase,
    IncrementRaceWagerUseCase,
    FinishRaceUseCase,
  ],
})
export class RaceModule {}
