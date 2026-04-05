import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LevelingModule } from '../user/statistics/leveling.module';

import { RollDiceUseCase } from '../../application/game/dice/use-cases/roll-dice.usecase';
import { GetDiceHistoryUseCase } from '../../application/game/dice/use-cases/get-dice-history.usecase';

import { DiceFairnessDomainService } from '../../domain/game/dice/services/dice-fairness.domain-service';

import { DiceBalanceLedgerAdapter } from '../../infrastructure/cache/adapters/dice-balance-ledger.adapter';
import { PrismaDiceHistoryRepository } from '../../infrastructure/persistance/repositories/game/dice-history.repository';
import { DiceHistoryCacheAdapter } from '../../infrastructure/cache/adapters/dice-history-cache.adapter';
import { UserSeedRepository } from '../../infrastructure/persistance/repositories/user/user-seed.repository';
import { BetEventPublisher } from '../../infrastructure/messaging/redis-pub-sub/bet-event.publisher';

import {
  DICE_CONFIG_PORT,
  DICE_BALANCE_LEDGER,
  DICE_HISTORY_REPOSITORY,
  DICE_HISTORY_CACHE_PORT,
  USER_SEED_REPOSITORY,
  DICE_BET_EVENT_PUBLISHER,
} from '../../application/game/dice/tokens/dice.tokens';
import { DiceConfigRedisAdapter } from '../../infrastructure/cache/adapters/dice-config.redis.adapter';
import { DiceModerationRedisService } from '../../infrastructure/cache/dice-moderation.redis.service';
import { DiceBettingDisabledRedisService } from '../../infrastructure/cache/dice-betting-disabled.redis.service';

import { DiceController } from '../../presentation/http/public/game/dice/dice.controller';

import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AuthModule } from '../auth.module';
import { ProvablyFairModule } from '../user/provably-fair.module';
import { RaceModule } from '../race.module';

@Module({
  imports: [
    AuthModule,
    LevelingModule,
    ProvablyFairModule,
    RaceModule,
  ],
  controllers: [DiceController],
  providers: [
    RollDiceUseCase,
    GetDiceHistoryUseCase,
    DiceModerationRedisService,
    DiceBettingDisabledRedisService,

    DiceFairnessDomainService,

    JwtAuthGuard,
    RolesGuard,

    { provide: DICE_CONFIG_PORT, useClass: DiceConfigRedisAdapter },
    { provide: DICE_BALANCE_LEDGER, useClass: DiceBalanceLedgerAdapter },
    { provide: DICE_HISTORY_REPOSITORY, useClass: PrismaDiceHistoryRepository },
    { provide: DICE_HISTORY_CACHE_PORT, useClass: DiceHistoryCacheAdapter },
    { provide: USER_SEED_REPOSITORY, useClass: UserSeedRepository },
    { provide: DICE_BET_EVENT_PUBLISHER, useClass: BetEventPublisher },
  ],
  exports: [RollDiceUseCase, GetDiceHistoryUseCase],
})
export class DiceModule {}
