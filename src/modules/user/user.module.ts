import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Tokens ──────────────────────────────────────────────────────────────────
import {
  BALANCE_REPOSITORY,
  BALANCE_CACHE_PORT,
} from '../../application/user/tokens/user.tokens.js';

// ── Application (use cases) ──────────────────────────────────────────────────
import { GetBalanceUseCase } from '../../application/user/use-cases/get-balance/get-balance.use-case.js';

// ── Infrastructure (port implementations) ───────────────────────────────────
import { PrismaBalanceRepository } from '../../infrastructure/persistance/repositories/user/balance.repository.js';
import { BalanceCacheAdapter } from '../../infrastructure/cache/adapters/balance-cache.adapter.js';

// ── Presentation ─────────────────────────────────────────────────────────────
import { BalanceController } from '../../presentation/http/public/user/balance.controller.js';

// ── Shared ───────────────────────────────────────────────────────────────────
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard.js';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [BalanceController],
  providers: [
    // Guards
    JwtAuthGuard,

    // Use cases
    GetBalanceUseCase,

    // Port → Implementation bindings
    // The use case depends on the Symbol tokens (interfaces).
    // NestJS resolves them to these concrete classes at runtime.
    { provide: BALANCE_REPOSITORY, useClass: PrismaBalanceRepository },
    { provide: BALANCE_CACHE_PORT,  useClass: BalanceCacheAdapter },
  ],
  exports: [
    // Export the use case so other modules (e.g., AdminModule)
    // can reuse GetBalanceUseCase without re-declaring providers.
    GetBalanceUseCase,
  ],
})
export class UserModule {}
