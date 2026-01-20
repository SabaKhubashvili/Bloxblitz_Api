import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { BetHistoryService } from './bet-history.service';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from 'src/middleware/jwt.middleware';

@Controller('user/history/bets')
export class BetHistoryController {
  constructor(private readonly betHistoryService: BetHistoryService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  getBetHistory(@Request() req: AuthenticatedRequest, @Query('page') page: number = 1) {
    if(page < 1 || !Number.isInteger(page) || isNaN(page) || !isFinite(page) || typeof page !== 'number') {
        throw new Error('Page number must be greater than 0');
    }
    return this.betHistoryService.getBetHistory(req.user.username, page);
  }
}
