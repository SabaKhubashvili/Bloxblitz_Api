import { MiddlewareConsumer, Module } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { RemoteBalanceProvider } from './providers/remote-balance.provider';
import { BALANCE_PROVIDER } from './providers/balance.tokens';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserRepository } from '../user.repository';
import { BalanceController } from './balance.controller';
import { RedisService } from 'src/provider/redis/redis.service';
import { KinguinModule } from 'src/public/modules/admin/kinguin/kinguin.module';
import { TransactionHistoryService } from '../transaction-history/transaction-history.service';
import { DiscordNotificationService } from 'src/utils/discord_webhook.util';
import { ConfigService } from '@nestjs/config';
@Module({
  controllers: [BalanceController],
  providers: [
    PrismaService,
    BalanceService,
    RemoteBalanceProvider,
    UserRepository,
    RedisService,
    KinguinModule,
    TransactionHistoryService,
    DiscordNotificationService,
    ConfigService,

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
