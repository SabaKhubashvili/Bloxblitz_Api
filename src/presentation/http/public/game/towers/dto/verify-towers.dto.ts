import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const LEVELS = [8, 10, 12, 16] as const;

export class VerifyTowersHttpDto {
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

  @IsString()
  @IsIn(DIFFICULTIES)
  difficulty: (typeof DIFFICULTIES)[number];

  @IsIn(LEVELS)
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  levels: (typeof LEVELS)[number];

  @IsOptional()
  @IsArray()
  expectedGemIndicesByRow?: number[][];
}
