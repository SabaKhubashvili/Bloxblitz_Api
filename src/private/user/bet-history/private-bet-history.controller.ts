import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { InternalServiceGuard } from 'src/middleware/InternalServiceGuard.middleware';
import { InternalController } from 'src/private/decorator/InternalController.decorator';
import { InsertBetHistoryDto } from './dto/insert-bet-history.dto';
import { BetHistoryService } from './private-bet-history.service';
import { UpdateBetHistoryDto } from './dto/update-bet-history.dto';

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
