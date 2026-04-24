import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsIn,
} from 'class-validator';

export class CreatePayoutDto {
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be positive' })
  amount: number;

  @IsNotEmpty({ message: 'Currency is required' })
  @IsString()
  @IsIn(["BTC","ETH","DOGE",'LTC',"USDT"], { message: 'Currency must be a valid crypto currency' })
  currency: string;

  @IsString()
  @IsIn(["BTC","ETH","DOGE",'LTC',"ETH_USDT"], { message: 'Kind must be a valid crypto currency' })
  @Transform(({ value }) => value.toUpperCase())
  kind: string;

  @IsString()
  @IsIn(["BTC","ETH","DOGE",'LTC',"USDT"], { message: 'Symbol must be a valid crypto currency' })
  @Transform(({ value }) => value.toUpperCase())
  symbol: string;

  @IsNotEmpty({ message: 'Address is required' })
  @IsString()
  address: string;
}
