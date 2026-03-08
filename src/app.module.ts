import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';

import { RedisModule } from './infrastructure/cache/redis.module';
import { PrismaModule } from './infrastructure/persistance/prisma/prisma.module';
import { WorkersModule } from './infrastructure/workers/workers.module';
import { MinesModule } from './modules/game/mines.module';
import { UserModule } from './modules/user/user.module';
import { LevelingModule } from './modules/user/statistics/leveling.module';
import { RakebackModule } from './modules/user/rakeback.module';
import { ProfileModule } from './modules/user/profile.module';
import { DailySpinModule } from './modules/rewards/daily-spin.module';
import { BetHistoryModule } from './modules/game/bet-history.module';
import { TransactionModule } from './modules/user/transaction.module';
import { KinguinModule } from './modules/kinguin.module';
import { UniwireModule } from './modules/uniwire.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    WorkersModule,
    MinesModule,
    UserModule,
    TransactionModule,
    LevelingModule,
    RakebackModule,
    ProfileModule,
    DailySpinModule,
    BetHistoryModule,
    KinguinModule,
    UniwireModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
