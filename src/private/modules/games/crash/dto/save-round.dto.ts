import { IsInt, IsNotEmpty, IsNumber, IsString, Min, Validate } from 'class-validator';
import { Type } from 'class-transformer';
import { TwoDecimalPlacesRegex } from 'src/class-validator/TwoDecimalPlacesRegex.validator';

export class SaveCrashRoundDto {
  @IsString()
  @IsNotEmpty()
  chainId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  roundNumber: number;

  @IsString()
  @IsNotEmpty()
  gameHash: string;

  @Type(() => Number)
  @Validate(TwoDecimalPlacesRegex)
  @Min(0)
  crashPoint: number;

  @IsString()
  @IsNotEmpty()
  clientSeed: string;
}
