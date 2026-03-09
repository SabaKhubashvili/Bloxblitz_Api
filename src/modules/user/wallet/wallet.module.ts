import { Module } from "@nestjs/common";
import { BALANCE_CACHE_PORT, BALANCE_REPOSITORY } from "src/application/user/tokens/user.tokens";
import { GetBalanceUseCase } from "src/application/user/use-cases/get-balance/get-balance.use-case";
import { BalanceCacheAdapter } from "src/infrastructure/cache/adapters/balance-cache.adapter";
import { PrismaBalanceRepository } from "src/infrastructure/persistance/repositories/user/balance.repository";
import { AuthModule } from "src/modules/auth.module";
import { BalanceController } from "src/presentation/http/public/user/balance.controller";

/**
 * Wallet module – user balance retrieval.
 *
 * Exposes GET /user/balance (JWT-protected) for authenticated users to fetch
 * their current balance. Uses a cache-aside pattern: BalanceCacheAdapter
 * provides short-lived read-through caching to reduce DB/Redis load during
 * polling.
 *
 * Providers:
 *   - GetBalanceUseCase: Application use case for balance lookup
 *   - BALANCE_REPOSITORY: Prisma-backed persistence for user balance
 *   - BALANCE_CACHE_PORT: Redis-backed cache adapter for balance reads
 */
@Module({
  imports:[AuthModule],
  controllers: [BalanceController],
  providers: [
    
    GetBalanceUseCase,
    { provide: BALANCE_REPOSITORY, useClass: PrismaBalanceRepository },
    { provide: BALANCE_CACHE_PORT, useClass: BalanceCacheAdapter },
  ],
})
export class WalletModule {}