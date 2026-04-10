import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class VerifyDiceHttpDto {
  @IsString()
  @IsNotEmpty()
  serverSeed: string;

  @IsString()
  @IsNotEmpty()
  clientSeed: string;

  @IsInt()
  @Min(0)
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  nonce: number;

  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  chance: number;

  @IsString()
  @IsIn(['OVER', 'UNDER', 'over', 'under'])
  rollMode: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) =>
    typeof value === 'string' ? parseFloat(value) : value,
  )
  expectedRollResult?: number;
}
