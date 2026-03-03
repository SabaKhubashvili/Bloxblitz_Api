import { IsInt, Max, Min } from 'class-validator';

export class SetUserLevelHttpDto {
  @IsInt()
  @Min(0)
  @Max(100)
  level!: number;
}
