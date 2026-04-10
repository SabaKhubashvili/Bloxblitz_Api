import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { StartTowersGameUseCase } from '../../application/game/towers/use-cases/start-towers-game.use-case';
import { GetActiveTowersGameUseCase } from '../../application/game/towers/use-cases/get-active-towers-game.use-case';
import { RevealTowersTileUseCase } from '../../application/game/towers/use-cases/reveal-towers-tile.use-case';
import { CashoutTowersGameUseCase } from '../../application/game/towers/use-cases/cashout-towers-game.use-case';
import { VerifyTowersGameUseCase } from '../../application/game/towers/use-cases/verify-towers-game.use-case';

import { TowersGameRepository } from '../../infrastructure/persistance/repositories/game/towers-game.repository';
import { TowersGameRedisService } from '../../infrastructure/game/towers/towers-game-redis.service';
import { TowersGameCacheMetricsService } from '../../infrastructure/game/towers/towers-game-cache-metrics.service';
import { TowersActiveGameService } from '../../infrastructure/game/towers/towers-active-game.service';
import { TowersGameAsyncPersistenceService } from '../../infrastructure/game/towers/towers-game-async-persistence.service';
import { IncrementUserBalanceUseCase } from '../../application/balance/use-cases/increment-user-balance.use-case';
import { DecrementUserBalanceUseCase } from '../../application/balance/use-cases/decrement-user-balance.use-case';
import { UserBalanceRedisRepository } from '../../infrastructure/cache/adapters/user-balance-redis.repository';
import { USER_BALANCE_REPOSITORY } from '../../application/balance/tokens/balance.tokens';

import { TowersController } from '../../presentation/http/public/game/towers/towers.controller';

import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../shared/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AuthModule } from '../auth.module';
import { PrismaModule } from '../../infrastructure/persistance/prisma/prisma.module';
import { RedisModule } from '../../infrastructure/cache/redis.module';
import { ProvablyFairModule } from '../user/provably-fair.module';
import { UserSeedRepository } from '../../infrastructure/persistance/repositories/user/user-seed.repository';
import { USER_SEED_REPOSITORY } from '../../application/game/dice/tokens/dice.tokens';
import { LevelingModule } from '../user/statistics/leveling.module';
import { BetEventPublisher } from '../../infrastructure/messaging/redis-pub-sub/bet-event.publisher';
import { BET_EVENT_PUBLISHER } from '../../application/game/mines/tokens/mines.tokens';
import {
  ROULETTE_ADMIN_WAGER_GATE_PROVIDER,
  TOWERS_RUNTIME_CONFIG_PROVIDER,
  TOWERS_SYSTEM_STATE_PROVIDER,
} from '../../application/game/towers/tokens/towers.tokens';
import { RouletteAdminWagerGateRedisAdapter } from '../../infrastructure/cache/adapters/roulette-admin-wager-gate.redis.adapter';
import { TowersSystemStateRedisAdapter } from '../../infrastructure/cache/adapters/towers-system-state.redis.adapter';
import { TowersRuntimeConfigRedisAdapter } from '../../infrastructure/cache/adapters/towers-runtime-config.redis.adapter';
import { TowersRestrictionRedisService } from '../../infrastructure/cache/towers-restriction.redis.service';
import { ValidateTowersPlayRestrictionUseCase } from '../../application/game/towers/use-cases/validate-towers-play-restriction.use-case';
@Module({
  imports: [
    AuthModule,
    JwtModule,
    PrismaModule,
    RedisModule,
    ProvablyFairModule,
    LevelingModule,
  ],
  controllers: [TowersController],
  providers: [
    { provide: USER_SEED_REPOSITORY, useClass: UserSeedRepository },
    StartTowersGameUseCase,
    GetActiveTowersGameUseCase,
    RevealTowersTileUseCase,
    CashoutTowersGameUseCase,
    VerifyTowersGameUseCase,
    TowersGameRepository,
    TowersGameRedisService,
    TowersGameCacheMetricsService,
    TowersActiveGameService,
    TowersGameAsyncPersistenceService,
    IncrementUserBalanceUseCase,
    DecrementUserBalanceUseCase,
    { provide: USER_BALANCE_REPOSITORY, useClass: UserBalanceRedisRepository },
    { provide: BET_EVENT_PUBLISHER, useClass: BetEventPublisher },
    {
      provide: TOWERS_SYSTEM_STATE_PROVIDER,
      useClass: TowersSystemStateRedisAdapter,
    },
    {
      provide: TOWERS_RUNTIME_CONFIG_PROVIDER,
      useClass: TowersRuntimeConfigRedisAdapter,
    },
    {
      provide: ROULETTE_ADMIN_WAGER_GATE_PROVIDER,
      useClass: RouletteAdminWagerGateRedisAdapter,
    },
    TowersRestrictionRedisService,
    ValidateTowersPlayRestrictionUseCase,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    RolesGuard,
  ],
  exports: [
    StartTowersGameUseCase,
    GetActiveTowersGameUseCase,
    RevealTowersTileUseCase,
    CashoutTowersGameUseCase,
  ],
})
export class TowersModule {}
