import { Module } from '@nestjs/common';
import { MinesController } from './mines.controller';
import { MinesService } from './mines.service';
import { RedisModule } from 'src/provider/redis/redis.module';
import { MinesRepository } from './mines.repository';
import { UserRepository } from 'src/user/user.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { SeedManagementService } from '../seed-managment/seed-managment.service';

@Module({
  imports: [RedisModule],
  controllers: [MinesController],
  providers: [MinesService,MinesRepository, UserRepository,PrismaService, SeedManagementService]
})
export class MinesModule {}
