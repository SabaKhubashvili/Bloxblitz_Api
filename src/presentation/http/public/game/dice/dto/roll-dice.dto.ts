import { IsIn, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class RollDiceHttpDto {
  @IsNumber()
  @Min(0.01)
  @Transform(({ value }) => (typeof value === 'string' ? parseFloat(value) : value))
  betAmount: number;

  /** Bounds enforced in RollDiceUseCase from Redis `dice:config` (minChance / maxChance). */
  @IsNumber()
  @Min(0.01)
  @Max(99.99)
  @Transform(({ value }) => (typeof value === 'string' ? parseFloat(value) : value))
  chance: number;

  @IsIn(['over', 'under', 'OVER', 'UNDER'])
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  rollMode: 'OVER' | 'UNDER';
}
