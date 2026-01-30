import { AvailableCryptos } from '@prisma/client';
import { IsEnum } from 'class-validator';
export class GetCryptoAddressByNameDto {
  @IsEnum(AvailableCryptos, {
    message: 'cryptoname must be one of: BTC, ETH, LTC',
  })
  coin: AvailableCryptos;
}
