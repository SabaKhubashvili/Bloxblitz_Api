import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { RedeemKinguinDto } from './dto/redeem-kinguin.dto';
import { JwtAuthGuard, type AuthenticatedRequest } from 'src/middleware/jwt.middleware';

@Controller('balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  // balance.controller.ts
  @Post('kinguin/redeem')
  @UseGuards(JwtAuthGuard)
  async redeemKinguin(
    @Body() dto: RedeemKinguinDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.balanceService.redeemKinguinCode(req.user.username, dto.code);
  }
  @Get('get')
  @UseGuards(JwtAuthGuard)
  async getBalance(@Req() req: AuthenticatedRequest) {
    return this.balanceService.getBalance(req.user.username);
  }
}
