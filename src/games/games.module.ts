import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { MinesModule } from './mines/mines.module';

@Module({
  controllers: [GamesController],
  providers: [GamesService],
  imports: [MinesModule]
})
export class GamesModule {}
