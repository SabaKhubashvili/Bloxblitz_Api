import { Module } from '@nestjs/common';
import { MinesController } from './mines.controller';
import { MinesRepository } from './repository/mines.repository';
import { MinesCalculationService } from './service/mines-calculation.service';
import { MinesValidationService } from './service/mines-validation.service';
import { MinesGameFactory } from './factory/mines-game.factory';
import { MinesPersistenceService } from './service/mines-persistence.service';
import { MinesHistoryService } from './service/mines-history.service';
import { MinesGameService } from './mines.service';
import { RedisService } from 'src/provider/redis/redis.service';
import { SeedManagementService } from '../seed-managment/seed-managment.service';
import { SharedUserGamesService } from 'src/shared/user/games/shared-user-games.service';
import { BetHistoryService } from 'src/private/modules/user/bet-history/private-bet-history.service';
import { UserRepository } from '../../user/user.repository';


@Module({
  controllers: [MinesController],
  providers: [
    MinesGameService,
    MinesCalculationService,
    MinesValidationService,
    MinesGameFactory,
    MinesPersistenceService,
    MinesHistoryService,
    MinesRepository,
    RedisService,
    SeedManagementService,
    SharedUserGamesService,
    BetHistoryService,
    UserRepository
  ],
  exports: [MinesGameService],
})
export class MinesModule {}
