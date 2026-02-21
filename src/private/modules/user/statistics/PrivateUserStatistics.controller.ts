import { Body, Get, Post, Query } from '@nestjs/common';
import { PrivateUserStatisticsService } from './PrivateUserStatistics.service';
import { getUserWagerDto } from './dto/get-wager.dto';

import { UpdateUserStatisticsDto } from './dto/update-statistics.dto';
import { incrementUserWagerDto } from './dto/increment-wager.dto';
import { GetCoinflipWagerDto } from './dto/get-coinflip-wager.dto';
import { InternalController } from '../../games/decorator/InternalController.decorator';

@InternalController('user/statistics')
export class PrivateUserStatisticsController {
  constructor(
    private readonly privateUserStatisticsService: PrivateUserStatisticsService,
  ) {}
  @Post('get-wager')
  async getUserWager(@Body() body: getUserWagerDto) {
    const response = await this.privateUserStatisticsService.getUserWager(
      body.username,
    );
    return {
      totalWagered: response?.totalWagered || 0,
    };
  }
  @Post('get-level')
  async getUserLevel(@Body() body: getUserWagerDto) {
    const response = await this.privateUserStatisticsService.getUserLevel(
      body.username,
    );
    return {
      level: response.userLevel || 0,
    };
  }
  @Post('increment-wager')
  async incrementUserWager(@Body() body: incrementUserWagerDto) {
    await this.privateUserStatisticsService.incrementTotalWager(
      body.username,
      body.amount,
    );
  }
}
