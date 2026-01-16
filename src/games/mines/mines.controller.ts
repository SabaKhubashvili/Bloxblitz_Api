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
import { RevealTileDto } from './dto/reveal.dto';
import { MinesService } from './mines.service';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from 'src/auth/jwt.middleware';

@Controller('games/mines')
export class MinesController {
  constructor(private readonly minesService: MinesService) {}

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
}
