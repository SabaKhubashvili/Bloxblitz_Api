// src/leveling/leveling.module.ts

import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LevelingService } from './leveling.service';
import { LevelingController } from './leveling.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { RedisService } from 'src/provider/redis/redis.service';


@Module({
  imports: [PrismaModule, EventEmitterModule.forRoot()],
  controllers: [LevelingController],
  providers: [LevelingService,RedisService],
  exports: [LevelingService],
})
export class LevelingModule {}