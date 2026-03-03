import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Use cases ─────────────────────────────────────────────────────────────────
import { GetUserLevelUseCase }   from '../../application/user/leveling/use-cases/get-user-level.use-case.js';
import { AddExperienceUseCase }  from '../../application/user/leveling/use-cases/add-experience.use-case.js';
import { SetUserLevelUseCase }   from '../../application/user/leveling/use-cases/set-user-level.use-case.js';
import { GetTierByLevelUseCase } from '../../application/user/leveling/use-cases/get-tier-by-level.use-case.js';

// ── Infrastructure ────────────────────────────────────────────────────────────
import { PrismaLevelingRepository } from '../../infrastructure/persistance/repositories/user/leveling.repository.js';
import { LevelingCacheAdapter }     from '../../infrastructure/cache/adapters/leveling-cache.adapter.js';

// ── Tokens ────────────────────────────────────────────────────────────────────
import {
  LEVELING_REPOSITORY,
  LEVELING_CACHE_PORT,
} from '../../application/user/leveling/tokens/leveling.tokens.js';

// ── Presentation ──────────────────────────────────────────────────────────────
import { LevelsController } from '../../presentation/http/public/leveling/levels.controller.js';

// ── Guards ────────────────────────────────────────────────────────────────────
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard.js';
import { RolesGuard }   from '../../shared/guards/roles.guard.js';

@Module({
  imports: [
    JwtModule.register({
      secret:       process.env.JWT_SECRET,
      signOptions:  { expiresIn: '7d' },
    }),
  ],
  controllers: [LevelsController],
  providers: [
    // Use cases
    GetUserLevelUseCase,
    AddExperienceUseCase,
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
    SetUserLevelUseCase,
    GetTierByLevelUseCase,
  ],
})
export class LevelingModule {}
