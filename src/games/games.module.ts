import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { MinesModule } from './mines/mines.module';
import { SeedManagementModule } from './seed-managment/seed-management.module';

@Module({
  controllers: [GamesController],
  providers: [GamesService],
  imports: [MinesModule,SeedManagementModule]
})
export class GamesModule {}
