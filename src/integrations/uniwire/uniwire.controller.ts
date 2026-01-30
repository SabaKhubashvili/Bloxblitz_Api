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
  // Parameterized routes LAST
  @Get(':coin')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async getStatus(
    @Param() params: GetCryptoAddressByNameDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const { coin } = params;
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
