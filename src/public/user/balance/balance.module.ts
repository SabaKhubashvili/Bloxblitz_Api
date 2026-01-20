import { MiddlewareConsumer, Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { RemoteBalanceProvider } from './providers/remote-balance.provider';
import { BALANCE_PROVIDER } from './providers/balance.tokens';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRepository } from '../user.repository';
import { BalanceController } from './balance.controller';
import { BalanceSyncWorker } from './balance-sync.worker';
import { RedisService } from 'src/provider/redis/redis.service';
@Module({
  controllers: [BalanceController],
  providers: [
    PrismaService,
    BalanceService,
    RemoteBalanceProvider,
    UserRepository,
    BalanceSyncWorker,
    RedisService,

    {
      provide: BALANCE_PROVIDER,
      useClass: RemoteBalanceProvider,
    },
  ],
})
export class BalanceModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply().forRoutes('api/balance');
  }
}
