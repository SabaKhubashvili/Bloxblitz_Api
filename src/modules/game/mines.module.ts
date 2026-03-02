import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// Use cases — game flow
import { CreateMinesGameUseCase } from '../../application/game/mines/use-cases/create-mines-game.use-case.js';
import { RevealTileUseCase } from '../../application/game/mines/use-cases/reveal-tile.use-case.js';
import { CashoutMinesGameUseCase } from '../../application/game/mines/use-cases/cashout-mines-game.use-case.js';
import { GetActiveMinesGameUseCase } from '../../application/game/mines/use-cases/get-active-mines-game.use-case.js';

// Use cases — history
import { GetUserMinesHistoryUseCase } from '../../application/game/mines/use-cases/get-user-mines-history.use-case.js';
import { GetMinesRoundByIdUseCase } from '../../application/game/mines/use-cases/get-mines-round-by-id.use-case.js';

// Domain services
import { MinesFairnessDomainService } from '../../domain/game/mines/services/mines-fairness.domain-service.js';

// Infrastructure — game flow
import { MinesGameRepository } from '../../infrastructure/persistance/repositories/game/mines-game.repository.js';
import { MinesGameStateCacheAdapter } from '../../infrastructure/cache/adapters/mines-game-state.cache-adapter.js';
import { MinesBalanceLedgerAdapter } from '../../infrastructure/cache/adapters/mines-balance-ledger.adapter.js';
import { BetEventPublisher } from '../../infrastructure/messaging/redis-pub-sub/bet-event.publisher.js';
import { UserSeedRepository } from '../../infrastructure/persistance/repositories/user/user-seed.repository.js';

// Infrastructure — history
import { PrismaMinesHistoryRepository } from '../../infrastructure/persistance/repositories/game/mines-history.repository.js';
import { MinesHistoryCacheAdapter } from '../../infrastructure/cache/adapters/mines-history-cache.adapter.js';

// Tokens
import {
  MINES_GAME_REPOSITORY,
  MINES_CACHE_PORT,
  MINES_BALANCE_LEDGER,
  BET_EVENT_PUBLISHER,
  USER_SEED_REPOSITORY,
  MINES_HISTORY_REPOSITORY,
  MINES_HISTORY_CACHE_PORT,
} from '../../application/game/mines/tokens/mines.tokens.js';

// Presentation
import { MinesController } from '../../presentation/http/public/game/mines/mines.controller.js';
import { MinesHistoryController } from '../../presentation/http/public/game/mines/mines-history.controller.js';

// Shared guards
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard.js';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
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

    // Domain services
    MinesFairnessDomainService,

    // Guards
    JwtAuthGuard,

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
