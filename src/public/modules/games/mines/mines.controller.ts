import {
  Controller,
  Post,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  Get,
  BadRequestException,
} from '@nestjs/common';
import { CreateGameDto } from './dto/create-game.dto';
import { RevealTileDto } from './dto/reveal-tile.dto';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from 'src/middleware/jwt.middleware';
import { MinesGameService } from './mines.service';
import { MinesHistoryService } from './service/mines-history.service';
import { VerifyMinesGameDto } from './dto/verify-game.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Mines Game')
@ApiBearerAuth()
@Controller('games/mines')
export class MinesController {
  constructor(
    private readonly minesService: MinesGameService,
    private readonly minesHistory: MinesHistoryService,
  ) {}

  /**
   * Create a new mines game
   */
  @Post('create')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a new mines game' })
  @ApiResponse({ status: 201, description: 'Game created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid game parameters' })
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
  @ApiOperation({ summary: 'Reveal a tile in an active game' })
  @ApiResponse({ status: 200, description: 'Tile revealed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid tile or game state' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async reveal(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RevealTileDto,
  ) {
    return this.minesService.revealTile(req.user.username, id, dto.tile);
  }

  /**
   * Cash out from active game
   */
  @Post(':id/cashout')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cash out from an active game' })
  @ApiResponse({ status: 200, description: 'Successfully cashed out' })
  @ApiResponse({ status: 400, description: 'Cannot cash out - invalid game state' })
  @ApiResponse({ status: 404, description: 'Game not found' })
  async cashout(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.minesService.cashout(req.user.username, id);
  }

  /**
   * Verify game fairness using provably fair algorithm
   */
  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Verify game fairness',
    description: 'Verify a completed game using server seed, client seed, and nonce',
  })
  @ApiResponse({
    status: 200,
    description: 'Game verified successfully',
    schema: {
      example: {
        verified: true,
        minePositions: [2, 5, 7, 12, 18],
        gridSize: 25,
        mines: 5,
        serverSeed: 'abc123...',
        clientSeed: 'player_seed',
        nonce: 42,
        message: 'Game successfully verified...',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid verification parameters' })
  async verifyGame(
    @Req() req: AuthenticatedRequest,
    @Body() dto: VerifyMinesGameDto,
  ) {
    const maxMines = dto.gridSize === 16 ? 15 : 24;
    if (dto.mines > maxMines) {
      throw new BadRequestException(
        `Grid size ${dto.gridSize} supports maximum ${maxMines} mines, but ${dto.mines} were specified`,
      );
    }

    return this.minesService.verifyGame(req.user.username, dto);
  }

  /**
   * Get current active game
   */
  @Get('active')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get current active game' })
  @ApiResponse({ status: 200, description: 'Active game retrieved' })
  @ApiResponse({ status: 404, description: 'No active game found' })
  async getActiveGame(@Req() req: AuthenticatedRequest) {
    return this.minesService.getActiveGame(req.user.username);
  }

  /**
   * Get game history
   */
  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user game history' })
  @ApiResponse({ status: 200, description: 'Game history retrieved successfully' })
  async getGameHistory(@Req() req: AuthenticatedRequest) {
    return this.minesHistory.getUserGameHistory(req.user.username, 15);
  }
}