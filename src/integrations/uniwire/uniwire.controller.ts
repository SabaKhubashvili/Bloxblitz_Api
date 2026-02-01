import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { GetCryptoAddressByNameDto } from './dto/get-crypto-address-by-name.dto';
import { UniwireService } from './uniwire.service';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from 'src/middleware/jwt.middleware';
import { UniwireCallbackGuard } from 'src/middleware/uniwireCallback.middleware';
import { CryptoCallbackDto } from './dto/uniwire-callback.dto';
import { CreatePayoutTransactionDto } from './dto/create-payout-transaction.dto';

@Controller('crypto')
export class UniwireController {
  constructor(private readonly uniwireService: UniwireService) {}

  // Specific routes FIRST
  @Get('exchange-rates')
  async getExchangeRates() {
    const rates = await this.uniwireService.getExchangeRates();
    return rates;
  }
  @Post('/callback')
  @UseGuards(UniwireCallbackGuard)
  async handleCallback(@Body() req: CryptoCallbackDto) {
    await this.uniwireService.processCallback(req);
    return { status: 'Callback received successfully' };
  }
  @Post('payout/:coin')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async payout(
    @Param() params: GetCryptoAddressByNameDto,
    @Body() body: CreatePayoutTransactionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { coin } = params;
    const result = await this.uniwireService.createPayoutTransaction({
      coin: coin,
      username: req.user.username,
      amount: body.amount,
      address: body.address,
    });
    return {
      payoutId: result.payoutId,
      status: result.status,
    };
  }
  // Parameterized routes LAST
  @Get(':coin')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getStatus(
    @Param() params: GetCryptoAddressByNameDto,
    @Req() req: AuthenticatedRequest,
  ) {
    
    const { coin } = params;
    console.log(coin);
    const result = await this.uniwireService.getUserDepositAddr({
      coin: coin,
      username: req.user.username,
    });
    return {
      address: result.address,
      recentTransactions: result.recentTransactions,
    };
  }
}
