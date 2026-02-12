import { Controller, Post, Body, Get } from '@nestjs/common';
import { KinguinService } from './kinguin.service';
import { CreateKinguinCodeDto } from './dto/create-kinguin-codes';

@Controller('admin/kinguin')
export class KinguinController {
  constructor(private readonly kinguinService: KinguinService) {}

  @Post('/code/generate')
  async generateNewKinguinCodes(@Body() data: CreateKinguinCodeDto) {
    return this.kinguinService.generateNewKinguinCodes(data.balanceAmount,data.quantity,data.offerId);
  }

  @Get('/offers')
  async getKinguinOffers() {
    return this.kinguinService.getKinguinOffers();
  }
}
