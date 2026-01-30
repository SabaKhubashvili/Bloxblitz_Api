import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BalanceService } from './balance.service';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from 'src/middleware/jwt.middleware';
import { TipBalanceToUserDto } from './dto/tip-balance-to-user.dto';

@Controller('balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}
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
    if (dto.recipientUsername === req.user.username) {
      throw new BadRequestException('You cannot tip yourself.');
    }
    return this.balanceService.tipUser(
      req.user.username,
      dto.recipientUsername,
      dto.amount,
    );
  }
}
