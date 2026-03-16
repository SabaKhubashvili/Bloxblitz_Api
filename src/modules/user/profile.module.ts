import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Tokens ──────────────────────────────────────────────────────────────────
import {
  PROFILE_REPOSITORY,
  PROFILE_CACHE_PORT,
} from '../../application/user/profile/tokens/profile.tokens';

// ── Application (use cases) ──────────────────────────────────────────────────
import { GetProfileUseCase } from '../../application/user/profile/use-cases/get-profile.use-case';
import { SetProfilePrivacyUseCase } from '../../application/user/profile/use-cases/set-profile-privacy.use-case';

// ── Infrastructure (port implementations) ───────────────────────────────────
import { PrismaProfileRepository } from '../../infrastructure/persistance/repositories/user/profile.repository';
import { ProfileCacheAdapter } from '../../infrastructure/cache/adapters/profile-cache.adapter';

// ── Presentation ─────────────────────────────────────────────────────────────
import { ProfileController } from '../../presentation/http/public/user/profile.controller';

// ── Shared ───────────────────────────────────────────────────────────────────
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AuthModule } from '../auth.module';
import { GetPublicProfileUseCase } from 'src/application/user/profile/use-cases/get-public-profile.use-case';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [ProfileController],
  providers: [
    JwtAuthGuard,

    GetProfileUseCase,
    GetPublicProfileUseCase,
    SetProfilePrivacyUseCase,

    { provide: PROFILE_REPOSITORY, useClass: PrismaProfileRepository },
    { provide: PROFILE_CACHE_PORT, useClass: ProfileCacheAdapter },
  ],
  exports: [GetProfileUseCase, SetProfilePrivacyUseCase],
})
export class ProfileModule {}
