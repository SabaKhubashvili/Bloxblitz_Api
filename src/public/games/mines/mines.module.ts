import { Module } from '@nestjs/common';
import { MinesController } from './mines.controller';
import { MinesService } from './mines.service';
import { RedisModule } from 'src/provider/redis/redis.module';
import { MinesRepository } from './mines.repository';
import { UserRepository } from 'src/public/user/user.repository';
import { SeedManagementService } from '../seed-managment/seed-managment.service';
import { BetHistoryModule } from 'src/private/user/bet-history/private-bet-history.module';
import { SharedUserGamesService } from 'src/shared/user/games/shared-user-games.service';

@Module({
  imports: [RedisModule, BetHistoryModule],
  controllers: [MinesController],
  providers: [MinesService,MinesRepository, UserRepository, SeedManagementService, SharedUserGamesService]
})
export class MinesModule {}
