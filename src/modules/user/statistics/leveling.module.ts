import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Use cases ─────────────────────────────────────────────────────────────────
import { GetUserLevelUseCase } from '../../../application/user/leveling/use-cases/get-user-level.use-case';
import { AddExperienceUseCase } from '../../../application/user/leveling/use-cases/add-experience.use-case';
import { GrantWagerXpUseCase } from '../../../application/user/leveling/use-cases/grant-wager-xp.use-case';
import { SetUserLevelUseCase } from '../../../application/user/leveling/use-cases/set-user-level.use-case';
import { GetTierByLevelUseCase } from '../../../application/user/leveling/use-cases/get-tier-by-level.use-case';

// ── Infrastructure ────────────────────────────────────────────────────────────
import { PrismaLevelingRepository } from '../../../infrastructure/persistance/repositories/user/leveling.repository';
import { LevelingCacheAdapter } from '../../../infrastructure/cache/adapters/leveling-cache.adapter';

// ── Tokens ────────────────────────────────────────────────────────────────────
import {
  LEVELING_REPOSITORY,
  LEVELING_CACHE_PORT,
} from '../../../application/user/leveling/tokens/leveling.tokens';

// ── Presentation ──────────────────────────────────────────────────────────────
import { LevelsController } from '../../../presentation/http/public/leveling/levels.controller';

// ── Guards ────────────────────────────────────────────────────────────────────
import { JwtAuthGuard } from '../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/guards/roles.guard';
import { AuthModule } from '../../auth.module';
import { RewardCasesModule } from '../../rewards/reward-cases.module';

@Module({
  imports: [AuthModule, RewardCasesModule],
  controllers: [LevelsController],
  providers: [
    // Use cases
    GetUserLevelUseCase,
    AddExperienceUseCase,
    GrantWagerXpUseCase,
    SetUserLevelUseCase,
    GetTierByLevelUseCase,

    // Guards
    JwtAuthGuard,
    RolesGuard,

    // Port bindings — repository
    { provide: LEVELING_REPOSITORY, useClass: PrismaLevelingRepository },

    // Port bindings — cache
    { provide: LEVELING_CACHE_PORT, useClass: LevelingCacheAdapter },
  ],
  exports: [
    GetUserLevelUseCase,
    AddExperienceUseCase,
    GrantWagerXpUseCase,
    SetUserLevelUseCase,
    GetTierByLevelUseCase,
  ],
})
export class LevelingModule {}
