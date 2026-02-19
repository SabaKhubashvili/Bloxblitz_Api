// src/leveling/leveling.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LevelingService } from './leveling.service';
import { LeaderboardQueryDto } from './dto/level-progress.dto';
import { type AuthenticatedRequest, JwtAuthGuard } from 'src/middleware/jwt.middleware';

@ApiTags('leveling')
@Controller('leveling')
export class LevelingController {
  constructor(private readonly levelingService: LevelingService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user level information' })
  async getMyLevelInfo(@Request() req: AuthenticatedRequest) {
    return this.levelingService.getUserLevelInfo(req.user.username);
  }

  @Get('user/:username')
  @ApiOperation({ summary: 'Get user level information by username' })
  async getUserLevelInfo(@Param('username') username: string) {
    return this.levelingService.getUserLevelInfo(username);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get level leaderboard' })
  async getLeaderboard(@Query() query: LeaderboardQueryDto) {
    return this.levelingService.getLevelLeaderboard(
      query.limit,
      query.offset,
    );
  }

  @Get('rank/:username')
  @ApiOperation({ summary: 'Get user rank on leaderboard' })
  async getUserRank(@Param('username') username: string) {
    const rank = await this.levelingService.getUserRank(username);
    return { username, rank };
  }

  @Get('distribution')
  @ApiOperation({ summary: 'Get levels distribution (analytics)' })
  async getLevelsDistribution() {
    return this.levelingService.getLevelsDistribution();
  }

  @Get('xp-calculator')
  @ApiOperation({ summary: 'Calculate XP for a given wager' })
  async calculateXp(
    @Query('wager') wager: number,
    @Query('gameType') gameType: string = 'COINFLIP',
    @Query('multiplier') multiplier: number = 1.0,
  ) {
    const xp = this.levelingService.calculateXpFromWager(
      wager,
      gameType,
      multiplier,
    );
    return { wager, gameType, multiplier, xp };
  }
}