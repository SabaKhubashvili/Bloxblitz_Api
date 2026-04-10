import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

const ROULETTE_COLORS = ['GREEN', 'BROWN', 'YELLOW'] as const;

export class VerifyRouletteHttpDto {
  @IsString()
  @IsNotEmpty()
  serverSeed: string;

  @IsString()
  @IsNotEmpty()
  eosBlockId: string;

  @IsInt()
  @Min(0)
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  gameIndex: number;

  @IsOptional()
  @IsIn(ROULETTE_COLORS)
  expectedOutcome?: (typeof ROULETTE_COLORS)[number];

  @IsOptional()
  @IsString()
  expectedOutcomeHash?: string;
}
