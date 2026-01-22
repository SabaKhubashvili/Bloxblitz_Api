import { Body, Post } from '@nestjs/common';
import { PrivateUserStatisticsService } from './PrivateUserStatistics.service';
import { getUserWagerDto } from './dto/get-wager.dto';
import { InternalController } from 'src/private/decorator/InternalController.decorator';
import { UpdateUserStatisticsDto } from './dto/update-statistics.dto';

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
      totalWagered: response,
    };
  }
  @Post('increment-wager')
  async incrementUserWager(@Body() body: getUserWagerDto & { amount: number }) {
    await this.privateUserStatisticsService.incrementTotalWager(
      body.username,
      body.amount,
    );
  }
  @Post('update-stats')
  async decrementUserWager(@Body() body: UpdateUserStatisticsDto) {
    await this.privateUserStatisticsService.updateStatistics(
      body.username,
      body.bet,
      body.isWinner,
      body.winAmount,
    );
  }
}