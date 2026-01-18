import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { ConfigModule } from '@nestjs/config';
import { BalanceModule } from './user/balance/balance.module';
import { GamesModule } from './games/games.module';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './user/user.module';
@Module({
  imports: [
    ConfigModule.forRoot(),
    ScheduleModule.forRoot(),
    AdminModule,
    GamesModule,

    UserModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
