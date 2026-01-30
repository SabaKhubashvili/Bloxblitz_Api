import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { GamesModule } from './public/modules/games/games.module';
import { ScheduleModule } from '@nestjs/schedule';
import { PrivateModule } from './private/private.module';
import { PrismaModule } from './prisma/prisma.module';
import { GiveawayModule } from './public/modules/giveaway/giveaway.module';
import { RedisModule } from './provider/redis/redis.module';
import { BotModule } from './public/modules/bot/bot.module';
import { UserModule } from './public/modules/user/user.module';
import { WorkersModule } from './workers/workers.module';
import { IntegrationsModule } from './integrations/integrations.module';
@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    AdminModule,
    GamesModule,
    PrismaModule,
    RedisModule,
    GiveawayModule,

    UserModule,
    BotModule,
    IntegrationsModule,

    PrivateModule,
    WorkersModule

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
