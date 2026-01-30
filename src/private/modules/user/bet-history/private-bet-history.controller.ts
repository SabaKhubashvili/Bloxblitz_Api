import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalServiceGuard } from 'src/middleware/InternalServiceGuard.middleware';
import { InsertBetHistoryDto } from './dto/insert-bet-history.dto';
import { BetHistoryService } from './private-bet-history.service';
import { UpdateBetHistoryDto } from './dto/update-bet-history.dto';
import { InternalController } from '../../games/decorator/InternalController.decorator';

@InternalController('user/bet-history')
@UseGuards(InternalServiceGuard)
export class BetHistoryController {
  constructor(private readonly betHistoryService: BetHistoryService) {}
  @Post('add')
  addBetHistory(@Body() body: InsertBetHistoryDto) {
    return this.betHistoryService.add(body);
  }
  @Post('update')
  updateBetHistory(@Body() body: UpdateBetHistoryDto) {
    return this.betHistoryService.update(body);
  }
}
