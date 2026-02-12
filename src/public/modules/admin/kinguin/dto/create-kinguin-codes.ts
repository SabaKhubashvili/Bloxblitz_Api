import { IsInt, IsPositive, IsDefined, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateKinguinCodeDto {
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  balanceAmount: number;

  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  quantity: number;


  @IsString()
  @IsDefined()
  offerId:string;
}
