import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Use cases ─────────────────────────────────────────────────────────────────
import { SpinDailyWheelUseCase }      from '../../application/rewards/daily-spin/use-cases/spin-daily-wheel.use-case';
import { GetDailySpinStatusUseCase }  from '../../application/rewards/daily-spin/use-cases/get-daily-spin-status.use-case';
import { GetDailySpinHistoryUseCase } from '../../application/rewards/daily-spin/use-cases/get-daily-spin-history.use-case';

// ── Tokens ────────────────────────────────────────────────────────────────────
import {
  DAILY_SPIN_REPOSITORY,
  DAILY_SPIN_CACHE_PORT,
  DAILY_SPIN_BALANCE_PORT,
} from '../../application/rewards/daily-spin/tokens/daily-spin.tokens';

// ── Infrastructure ────────────────────────────────────────────────────────────
import { PrismaDailySpinRepository } from '../../infrastructure/persistance/repositories/rewards/daily-spin.repository';
import { DailySpinCacheAdapter }     from '../../infrastructure/cache/adapters/daily-spin-cache.adapter';
import { DailySpinBalanceAdapter }   from '../../infrastructure/cache/adapters/daily-spin-balance.adapter';

// ── Presentation ──────────────────────────────────────────────────────────────
import { DailySpinController } from '../../presentation/http/public/user/rewards/daily-spin/daily-spin.controller';

// ── Cross-module dependency ───────────────────────────────────────────────────
// GetUserLevelUseCase is exported by LevelingModule and injected by the
// SpinDailyWheelUseCase and GetDailySpinStatusUseCase.
import { LevelingModule } from '../user/statistics/leveling.module';
import { AuthModule } from '../auth.module';

// ── Guards ────────────────────────────────────────────────────────────────────
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard }   from '../../shared/guards/roles.guard';

@Module({
  imports: [
    AuthModule,
    // Provides GetUserLevelUseCase
    LevelingModule,
  ],
  controllers: [DailySpinController],
  providers: [
    // Use cases
    SpinDailyWheelUseCase,
    GetDailySpinStatusUseCase,
    GetDailySpinHistoryUseCase,

    // Guards
    JwtAuthGuard,
    RolesGuard,

    // Port bindings
    { provide: DAILY_SPIN_REPOSITORY,   useClass: PrismaDailySpinRepository },
    { provide: DAILY_SPIN_CACHE_PORT,   useClass: DailySpinCacheAdapter     },
    { provide: DAILY_SPIN_BALANCE_PORT, useClass: DailySpinBalanceAdapter   },
  ],
})
export class DailySpinModule {}
