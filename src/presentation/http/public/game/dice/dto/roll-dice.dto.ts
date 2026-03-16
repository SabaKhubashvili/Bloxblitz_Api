import { IsIn, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class RollDiceHttpDto {
  @IsNumber()
  @Min(0.1)
  @Transform(({ value }) => (typeof value === 'string' ? parseFloat(value) : value))
  betAmount: number;

  @IsNumber()
  @Min(2)
  @Max(98)
  @Transform(({ value }) => (typeof value === 'string' ? parseFloat(value) : value))
  chance: number;

  @IsIn(['over', 'under', 'OVER', 'UNDER'])
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  rollMode: 'OVER' | 'UNDER';
}
