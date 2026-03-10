import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Tokens ──────────────────────────────────────────────────────────────────
import {
  BALANCE_REPOSITORY,
  BALANCE_CACHE_PORT,
} from '../../application/user/tokens/user.tokens';

// ── Application (use cases) ──────────────────────────────────────────────────
import { GetBalanceUseCase } from '../../application/user/balance/use-cases/get-balance/get-balance.use-case';

// ── Infrastructure (port implementations) ───────────────────────────────────
import { PrismaBalanceRepository } from '../../infrastructure/persistance/repositories/user/balance.repository';
import { BalanceCacheAdapter } from '../../infrastructure/cache/adapters/balance-cache.adapter';

// ── Shared ───────────────────────────────────────────────────────────────────
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard }   from '../../shared/guards/roles.guard';
import { AuthModule } from '../auth.module';
import { WalletModule } from './wallet/wallet.module';

@Module({
  imports: [
    AuthModule,
    WalletModule
  ],
  providers: [
    // Guards
    JwtAuthGuard,
    RolesGuard,
  ],
})
export class UserModule {}
