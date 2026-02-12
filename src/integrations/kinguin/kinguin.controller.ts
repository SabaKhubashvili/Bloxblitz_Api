
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from 'src/middleware/jwt.middleware';
import { RedeemKinguinDto } from './dto/redeem-code.dto';
import { BalanceService } from 'src/public/modules/user/balance/balance.service';

@Controller('kinguin')
export class KinguinController {
  constructor(private readonly balanceService: BalanceService) {}
  
  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  async redeemKinguin(
    @Body() dto: RedeemKinguinDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.balanceService.redeemKinguinCode(req.user.username, dto.code);
  }
}
