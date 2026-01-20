import { Module } from '@nestjs/common';
import { SeedManagementService } from './seed-managment.service';
import { SeedManagementController } from './seed-managment.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/provider/redis/redis.service';
import { SharedUserGamesService } from 'src/shared/user/games/shared-user-games.service';
import { MinesPersistenceService } from '../mines/service/mines-persistence.service';
import { BetHistoryService } from 'src/private/user/bet-history/private-bet-history.service';
import { MinesCalculationService } from '../mines/service/mines-calculation.service';

@Module({
  controllers: [SeedManagementController],
  providers: [
    SeedManagementService,
    PrismaService,
    RedisService,
    SharedUserGamesService,
    MinesPersistenceService,
    BetHistoryService,
    MinesCalculationService
  ],
  exports: [SeedManagementService],
})
export class SeedManagementModule {}
