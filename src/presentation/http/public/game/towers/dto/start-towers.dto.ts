import { IsIn, IsNumber, Min, Max } from 'class-validator';

const LEVELS = [8, 10, 12, 16] as const;

export class StartTowersHttpDto {
  @IsNumber()
  @Min(0.01)
  @Max(3000)
  betAmount!: number;

  @IsIn(['easy', 'medium', 'hard'])
  difficulty!: 'easy' | 'medium' | 'hard';

  @IsIn(LEVELS)
  levels!: (typeof LEVELS)[number];
}
