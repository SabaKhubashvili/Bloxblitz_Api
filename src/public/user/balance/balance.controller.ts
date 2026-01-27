import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { RedeemKinguinDto } from './dto/redeem-kinguin.dto';
import { JwtAuthGuard, type AuthenticatedRequest } from 'src/middleware/jwt.middleware';
import { TipBalanceToUserDto } from './dto/tip-balance-to-user.dto';

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
  @Post('tip')
  @UseGuards(JwtAuthGuard)
  async tipUser(
    @Body() dto: TipBalanceToUserDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if(dto.receipmentUsername === req.user.username) {
      throw new BadRequestException("You cannot tip yourself.");
    }
    return this.balanceService.tipUser(
      req.user.username,
      dto.receipmentUsername,
      dto.amount,
    );
  }

}
