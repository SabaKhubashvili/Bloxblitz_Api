import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// Use cases
import { GetUserBetHistoryUseCase } from '../../application/game/bet-history/use-cases/get-user-bet-history.use-case';
import { GetBetByIdUseCase } from '../../application/game/bet-history/use-cases/get-bet-by-id.use-case';

// Infrastructure
import { PrismaBetHistoryRepository } from '../../infrastructure/persistance/repositories/game/bet-history.repository';

// Tokens
import { BET_HISTORY_REPOSITORY } from '../../application/game/bet-history/tokens/bet-history.tokens';

// Presentation
import { BetHistoryController } from '../../presentation/http/public/game/bet-history/bet-history.controller';

// Shared guards
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AuthModule } from '../auth.module';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [BetHistoryController],
  providers: [
    // Use cases
    GetUserBetHistoryUseCase,
    GetBetByIdUseCase,

    // Guards
    JwtAuthGuard,

    // Port bindings
    { provide: BET_HISTORY_REPOSITORY, useClass: PrismaBetHistoryRepository },
  ],
  exports: [
    GetUserBetHistoryUseCase,
    GetBetByIdUseCase,
  ],
})
export class BetHistoryModule {}
