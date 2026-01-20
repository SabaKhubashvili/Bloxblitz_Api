import {
  Controller,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  Get,
} from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { RevealTileDto } from './dto/reveal-tile.dto';

import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from 'src/middleware/jwt.middleware';
import { MinesGameService } from './mines.service';
import { MinesHistoryService } from './service/mines-history.service';

@Controller('games/mines')
export class MinesController {
  constructor(private readonly minesService: MinesGameService, private readonly minesHistory: MinesHistoryService) {}

  /**
   * Create a new mines game
   */
  @Post('create')
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateGameDto) {


    return this.minesService.createGame(
      dto.betAmount,
      req.user.username,
      dto.mineCount,
      dto.gridSize,
    );
  }

  /**
   * Reveal a tile
   */
  @Post(':id/reveal')
  @UseGuards(JwtAuthGuard)
  async reveal(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: RevealTileDto) {
    return this.minesService.revealTile(req.user.username, id, dto.tile);
  }

  @Post(':id/cashout')
  @UseGuards(JwtAuthGuard)
  async cashout(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.minesService.cashout(req.user.username, id);
  }

  @Get('active')
  @UseGuards(JwtAuthGuard)
  async getActiveGame(@Req() req: AuthenticatedRequest) {
    return this.minesService.getActiveGame(req.user.username);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getGameHistory(@Req() req: AuthenticatedRequest) {
    return this.minesHistory.getUserHistory(req.user.username);
  }
}
