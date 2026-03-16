import { IsInt, IsOptional, IsIn, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class DiceHistoryQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 1))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => (value ? parseInt(value, 10) : 20))
  limit?: number = 20;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  @Transform(({ value }) => value ?? 'desc')
  order?: 'asc' | 'desc' = 'desc';
}
