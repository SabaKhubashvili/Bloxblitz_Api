import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';

import { RedisModule } from './infrastructure/cache/redis.module';
import { PrismaModule } from './infrastructure/persistance/prisma/prisma.module';
import { WorkersModule } from './infrastructure/workers/workers.module';
import { MinesModule } from './modules/game/mines.module';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    RedisModule,
    WorkersModule,
    MinesModule,
    UserModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
