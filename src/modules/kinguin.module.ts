import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { RedeemKinguinCodeUseCase } from '../application/kinguin/use-cases/redeem-kinguin-code.use-case';
import { ImportKinguinBatchUseCase } from '../application/kinguin/use-cases/import-kinguin-batch.use-case';
import { GetKinguinBatchesUseCase } from '../application/kinguin/use-cases/get-kinguin-batches.use-case';
import { GetKinguinBatchCodesUseCase } from '../application/kinguin/use-cases/get-kinguin-batch-codes.use-case';
import { DisableKinguinCodeUseCase } from '../application/kinguin/use-cases/disable-kinguin-code.use-case';
import { GetKinguinStatsUseCase } from '../application/kinguin/use-cases/get-kinguin-stats.use-case';
import { GetKinguinRedemptionLogsUseCase } from '../application/kinguin/use-cases/get-kinguin-redemption-logs.use-case';

import {
  KINGUIN_CODE_REPOSITORY,
  KINGUIN_BATCH_REPOSITORY,
  KINGUIN_REDEMPTION_LOG_REPOSITORY,
  KINGUIN_BALANCE_PORT,
  KINGUIN_CACHE_PORT,
} from '../application/kinguin/tokens/kinguin.tokens';

import { PrismaKinguinCodeRepository } from '../infrastructure/persistance/repositories/kinguin/prisma-kinguin-code.repository';
import { PrismaKinguinBatchRepository } from '../infrastructure/persistance/repositories/kinguin/prisma-kinguin-batch.repository';
import { PrismaKinguinRedemptionLogRepository } from '../infrastructure/persistance/repositories/kinguin/prisma-kinguin-redemption-log.repository';
import { KinguinBalanceAdapter } from '../infrastructure/cache/adapters/kinguin-balance.adapter';
import { KinguinCacheAdapter } from '../infrastructure/cache/adapters/kinguin-cache.adapter';

import { KinguinController } from '../presentation/http/public/kinguin/kinguin.controller';

import { TransactionModule } from './user/transaction.module';
import { JwtAuthGuard } from '../shared/guards/jwt-auth.guard';
import { RedisModule } from '../infrastructure/cache/redis.module';
import { PrismaModule } from '../infrastructure/persistance/prisma/prisma.module';
import { AuthModule } from './auth.module';

@Module({
  imports: [
    AuthModule,
    TransactionModule,
    RedisModule,
    PrismaModule,
  ],
  controllers: [KinguinController],
  providers: [
    RedeemKinguinCodeUseCase,
    ImportKinguinBatchUseCase,
    GetKinguinBatchesUseCase,
    GetKinguinBatchCodesUseCase,
    DisableKinguinCodeUseCase,
    GetKinguinStatsUseCase,
    GetKinguinRedemptionLogsUseCase,
    JwtAuthGuard,
    { provide: KINGUIN_CODE_REPOSITORY, useClass: PrismaKinguinCodeRepository },
    { provide: KINGUIN_BATCH_REPOSITORY, useClass: PrismaKinguinBatchRepository },
    {
      provide: KINGUIN_REDEMPTION_LOG_REPOSITORY,
      useClass: PrismaKinguinRedemptionLogRepository,
    },
    { provide: KINGUIN_BALANCE_PORT, useClass: KinguinBalanceAdapter },
    { provide: KINGUIN_CACHE_PORT, useClass: KinguinCacheAdapter },
  ],
  exports: [
    KINGUIN_BALANCE_PORT,
    RedeemKinguinCodeUseCase,
    ImportKinguinBatchUseCase,
    GetKinguinBatchesUseCase,
    GetKinguinBatchCodesUseCase,
    DisableKinguinCodeUseCase,
    GetKinguinStatsUseCase,
    GetKinguinRedemptionLogsUseCase,
  ],
})
export class KinguinModule {}
