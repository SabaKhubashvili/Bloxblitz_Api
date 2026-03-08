import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RedeemKinguinPromoCodeDto {
  @IsNotEmpty({ message: 'Promo code is required' })
  @IsString()
  @MaxLength(256)
  promoCode: string;
}
