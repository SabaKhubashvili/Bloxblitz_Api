import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Tokens ──────────────────────────────────────────────────────────────────
import {
  PROFILE_REPOSITORY,
  PROFILE_CACHE_PORT,
} from '../../application/user/profile/tokens/profile.tokens.js';

// ── Application (use cases) ──────────────────────────────────────────────────
import { GetProfileUseCase } from '../../application/user/profile/use-cases/get-profile.use-case.js';

// ── Infrastructure (port implementations) ───────────────────────────────────
import { PrismaProfileRepository } from '../../infrastructure/persistance/repositories/user/profile.repository.js';
import { ProfileCacheAdapter } from '../../infrastructure/cache/adapters/profile-cache.adapter.js';

// ── Presentation ─────────────────────────────────────────────────────────────
import { ProfileController } from '../../presentation/http/public/user/profile.controller.js';

// ── Shared ───────────────────────────────────────────────────────────────────
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard.js';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [ProfileController],
  providers: [
    JwtAuthGuard,

    GetProfileUseCase,

    { provide: PROFILE_REPOSITORY, useClass: PrismaProfileRepository },
    { provide: PROFILE_CACHE_PORT, useClass: ProfileCacheAdapter },
  ],
  exports: [GetProfileUseCase],
})
export class ProfileModule {}
