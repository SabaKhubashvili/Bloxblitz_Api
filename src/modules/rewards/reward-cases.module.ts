import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Application layer ─────────────────────────────────────────────────────────
import { RewardCaseKeysService } from '../../application/rewards/reward-cases/reward-case-keys.service';
import { OpenRewardCaseUseCase } from '../../application/rewards/reward-cases/use-cases/open-reward-case.use-case';
import { IncrementUserBalanceUseCase } from '../../application/balance/use-cases/increment-user-balance.use-case';

// ── Tokens ────────────────────────────────────────────────────────────────────
import {
  REWARD_CASES_CACHE_PORT,
  REWARD_CASE_OPEN_REPOSITORY,
} from '../../application/rewards/reward-cases/tokens/reward-cases.tokens';
import { USER_BALANCE_REPOSITORY } from '../../application/balance/tokens/balance.tokens';

// ── Infrastructure ────────────────────────────────────────────────────────────
import { RewardCasesCacheAdapter } from '../../infrastructure/cache/adapters/reward-cases-cache.adapter';
import { UserBalanceRedisRepository } from '../../infrastructure/cache/adapters/user-balance-redis.repository';
import { PrismaRewardCaseOpenRepository } from '../../infrastructure/persistance/repositories/rewards/reward-case-open.repository';

// ── Presentation ──────────────────────────────────────────────────────────────
import { RewardCasesController } from '../../presentation/http/public/user/rewards/reward-cases/reward-cases.controller';

// ── Cross-module ──────────────────────────────────────────────────────────────
import { AuthModule } from '../auth.module';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';

@Module({
  imports: [AuthModule, JwtModule],
  controllers: [RewardCasesController],
  providers: [
    // ── Application layer ───────────────────────────────────────────────────
    RewardCaseKeysService,
    OpenRewardCaseUseCase,
    IncrementUserBalanceUseCase,

    // ── Guards ──────────────────────────────────────────────────────────────
    JwtAuthGuard,
    RolesGuard,

    // ── Port bindings ───────────────────────────────────────────────────────
    { provide: REWARD_CASES_CACHE_PORT,      useClass: RewardCasesCacheAdapter        },
    { provide: REWARD_CASE_OPEN_REPOSITORY,  useClass: PrismaRewardCaseOpenRepository },
    { provide: USER_BALANCE_REPOSITORY, useClass: UserBalanceRedisRepository },
  ],
  exports: [RewardCaseKeysService],
})
export class RewardCasesModule {}
