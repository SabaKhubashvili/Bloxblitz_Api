import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { BalanceModule } from './public/user/balance/balance.module';
import { GamesModule } from './public/games/games.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './public/user/user.module';
import { PrivateModule } from './private/private.module';
import { PrismaModule } from './prisma/prisma.module';
import { GiveawayModule } from './public/giveaway/giveaway.module';
@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    AdminModule,
    GamesModule,
    PrismaModule,
    GiveawayModule,

    UserModule,

    PrivateModule,

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
