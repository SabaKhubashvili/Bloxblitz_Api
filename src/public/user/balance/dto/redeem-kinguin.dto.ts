import { IsString, IsNotEmpty, Length } from 'class-validator';

export class RedeemKinguinDto {
  @IsString()
  @IsNotEmpty()
  @Length(5, 50)
  code: string;
}
