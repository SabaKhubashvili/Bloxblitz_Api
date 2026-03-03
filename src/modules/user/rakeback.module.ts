import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Use cases ────────────────────────────────────────────────────────────────
import { AccumulateRakebackUseCase }  from '../../application/user/rakeback/use-cases/accumulate-rakeback.use-case.js';
import { GetRakebackDataUseCase }     from '../../application/user/rakeback/use-cases/get-rakeback-data.use-case.js';
import { ClaimRakebackUseCase }       from '../../application/user/rakeback/use-cases/claim-rakeback.use-case.js';
import { OpenClaimWindowUseCase }     from '../../application/user/rakeback/use-cases/open-claim-window.use-case.js';
import { CloseClaimWindowUseCase }    from '../../application/user/rakeback/use-cases/close-claim-window.use-case.js';
import { ResetMissedStreakUseCase }   from '../../application/user/rakeback/use-cases/reset-missed-streak.use-case.js';

// ── Tokens ───────────────────────────────────────────────────────────────────
import {
  RAKEBACK_REPOSITORY,
  RAKEBACK_CACHE_PORT,
  RAKEBACK_BALANCE_PORT,
  TIME_PROVIDER,
} from '../../application/user/rakeback/tokens/rakeback.tokens.js';

// ── Infrastructure ───────────────────────────────────────────────────────────
import { PrismaRakebackRepository } from '../../infrastructure/persistance/repositories/user/rakeback.repository.js';
import { RakebackCacheAdapter }     from '../../infrastructure/cache/adapters/rakeback-cache.adapter.js';
import { RakebackBalanceAdapter }   from '../../infrastructure/cache/adapters/rakeback-balance.adapter.js';
import { SystemTimeProvider }       from '../../infrastructure/time/system-time-provider.js';

// ── Workers ──────────────────────────────────────────────────────────────────
import { RakebackAccumulationWorker } from '../../infrastructure/workers/rakeback-accumulation.worker.js';
import { RakebackSchedulerWorker }    from '../../infrastructure/workers/rakeback-scheduler.worker.js';

// ── Presentation ─────────────────────────────────────────────────────────────
import { RakebackController } from '../../presentation/http/public/rakeback/rakeback.controller.js';

// ── Guards ────────────────────────────────────────────────────────────────────
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard.js';
import { RolesGuard }   from '../../shared/guards/roles.guard.js';

@Module({
  imports: [
    JwtModule.register({
      secret:      process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [RakebackController],
  providers: [
    // Use cases
    AccumulateRakebackUseCase,
    GetRakebackDataUseCase,
    ClaimRakebackUseCase,
    OpenClaimWindowUseCase,
    CloseClaimWindowUseCase,
    ResetMissedStreakUseCase,

    // Guards
    JwtAuthGuard,
    RolesGuard,

    // Workers
    RakebackAccumulationWorker,
    RakebackSchedulerWorker,

    // Port bindings
    { provide: RAKEBACK_REPOSITORY,   useClass: PrismaRakebackRepository },
    { provide: RAKEBACK_CACHE_PORT,   useClass: RakebackCacheAdapter },
    { provide: RAKEBACK_BALANCE_PORT, useClass: RakebackBalanceAdapter },
    { provide: TIME_PROVIDER,         useClass: SystemTimeProvider },
  ],
  exports: [
    AccumulateRakebackUseCase,
    GetRakebackDataUseCase,
    ClaimRakebackUseCase,
  ],
})
export class RakebackModule {}
