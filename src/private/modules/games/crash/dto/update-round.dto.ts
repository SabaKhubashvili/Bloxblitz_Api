import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  Min,
  Validate,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TwoDecimalPlacesRegex } from 'src/class-validator/TwoDecimalPlacesRegex.validator';

export class UpdateCrashRoundDto {
  @IsString()
  @IsNotEmpty()
  chainId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  roundNumber: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Validate(TwoDecimalPlacesRegex)
  @Min(0)
  totalBets?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Validate(TwoDecimalPlacesRegex)
  @Min(0)
  totalWagered?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Validate(TwoDecimalPlacesRegex)
  @Min(0)
  totalPayout?: number;

  
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  finished?: boolean;
}
