import { MiddlewareConsumer, Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { RemoteBalanceProvider } from './providers/remote-balance.provider';
import { BALANCE_PROVIDER } from './providers/balance.tokens';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRepository } from '../user.repository';
import { BalanceController } from './balance.controller';
import { RedisService } from 'src/provider/redis/redis.service';
import { KinguinModule } from 'src/admin/kinguin/kinguin.module';
@Module({
  controllers: [BalanceController],
  providers: [
    PrismaService,
    BalanceService,
    RemoteBalanceProvider,
    UserRepository,
    RedisService,
    KinguinModule,

    {
      provide: BALANCE_PROVIDER,
      useClass: RemoteBalanceProvider,
    },
  ],
  exports: [BalanceService],
})
export class BalanceModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply().forRoutes('api/balance');
  }
}
