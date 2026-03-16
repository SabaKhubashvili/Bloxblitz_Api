import { Module } from '@nestjs/common';
import { AuthModule } from '../auth.module';
import { PrismaModule } from '../../infrastructure/persistance/prisma/prisma.module';
import { RedisModule } from '../../infrastructure/cache/redis.module';
import { ProvablyFairController } from '../../presentation/http/public/user/provably-fair/provably-fair.controller';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { GetProvablyFairDataUseCase } from '../../application/user/provably-fair/use-cases/get-provably-fair-data.use-case';
import { RotateClientSeedUseCase } from '../../application/user/provably-fair/use-cases/rotate-client-seed.use-case';
import { PrismaProvablyFairRepository } from '../../infrastructure/persistance/repositories/user/prisma-provably-fair.repository';
import { PROVABLY_FAIR_DB_PORT } from '../../application/user/provably-fair/tokens/provably-fair.tokens';

@Module({
  imports: [AuthModule, PrismaModule, RedisModule],
  controllers: [ProvablyFairController],
  providers: [
    JwtAuthGuard,
    GetProvablyFairDataUseCase,
    RotateClientSeedUseCase,
    PrismaProvablyFairRepository,
    { provide: PROVABLY_FAIR_DB_PORT, useClass: PrismaProvablyFairRepository },
  ],
})
export class ProvablyFairModule {}
