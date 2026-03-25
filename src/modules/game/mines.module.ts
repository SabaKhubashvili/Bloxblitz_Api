import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { LevelingModule } from '../user/statistics/leveling.module';

// Use cases — game flow
import { CreateMinesGameUseCase } from '../../application/game/mines/use-cases/create-mines-game.use-case';
import { RevealTileUseCase } from '../../application/game/mines/use-cases/reveal-tile.use-case';
import { CashoutMinesGameUseCase } from '../../application/game/mines/use-cases/cashout-mines-game.use-case';
import { GetActiveMinesGameUseCase } from '../../application/game/mines/use-cases/get-active-mines-game.use-case';

// Use cases — history
import { GetUserMinesHistoryUseCase } from '../../application/game/mines/use-cases/get-user-mines-history.use-case';
import { GetMinesRoundByIdUseCase } from '../../application/game/mines/use-cases/get-mines-round-by-id.use-case';
import { VerifyMinesGameUseCase } from '../../application/game/mines/use-cases/verify-mines-game.use-case';

// Domain services
import { MinesFairnessDomainService } from '../../domain/game/mines/services/mines-fairness.domain-service';

// Infrastructure — game flow
import { MinesGameRepository } from '../../infrastructure/persistance/repositories/game/mines-game.repository';
import { MinesGameStateCacheAdapter } from '../../infrastructure/cache/adapters/mines-game-state.cache-adapter';
import { MinesBalanceLedgerAdapter } from '../../infrastructure/cache/adapters/mines-balance-ledger.adapter';
import { BetEventPublisher } from '../../infrastructure/messaging/redis-pub-sub/bet-event.publisher';
import { UserSeedRepository } from '../../infrastructure/persistance/repositories/user/user-seed.repository';

// Infrastructure — history
import { PrismaMinesHistoryRepository } from '../../infrastructure/persistance/repositories/game/mines-history.repository';
import { MinesHistoryCacheAdapter } from '../../infrastructure/cache/adapters/mines-history-cache.adapter';

// Tokens
import {
  MINES_GAME_REPOSITORY,
  MINES_CACHE_PORT,
  MINES_BALANCE_LEDGER,
  BET_EVENT_PUBLISHER,
  USER_SEED_REPOSITORY,
  MINES_HISTORY_REPOSITORY,
  MINES_HISTORY_CACHE_PORT,
} from '../../application/game/mines/tokens/mines.tokens';

// Presentation
import { MinesController } from '../../presentation/http/public/game/mines/mines.controller';
import { MinesHistoryController } from '../../presentation/http/public/game/mines/mines-history.controller';

// Shared guards
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard }   from '../../shared/guards/roles.guard';
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
  controllers: [MinesController, MinesHistoryController],
  providers: [
    // Use cases — game flow
    CreateMinesGameUseCase,
    RevealTileUseCase,
    CashoutMinesGameUseCase,
    GetActiveMinesGameUseCase,

    // Use cases — history
    GetUserMinesHistoryUseCase,
    GetMinesRoundByIdUseCase,
    VerifyMinesGameUseCase,

    // Domain services
    MinesFairnessDomainService,

    // Guards
    JwtAuthGuard,
    RolesGuard,

    // Port bindings — game flow
    { provide: MINES_GAME_REPOSITORY, useClass: MinesGameRepository },
    { provide: MINES_CACHE_PORT,      useClass: MinesGameStateCacheAdapter },
    { provide: MINES_BALANCE_LEDGER,  useClass: MinesBalanceLedgerAdapter },
    { provide: BET_EVENT_PUBLISHER,   useClass: BetEventPublisher },
    { provide: USER_SEED_REPOSITORY,  useClass: UserSeedRepository },

    // Port bindings — history
    { provide: MINES_HISTORY_REPOSITORY, useClass: PrismaMinesHistoryRepository },
    { provide: MINES_HISTORY_CACHE_PORT, useClass: MinesHistoryCacheAdapter },
  ],
  exports: [
    CreateMinesGameUseCase,
    RevealTileUseCase,
    CashoutMinesGameUseCase,
    GetActiveMinesGameUseCase,
    GetUserMinesHistoryUseCase,
    GetMinesRoundByIdUseCase,
  ],
})
export class MinesModule {}
