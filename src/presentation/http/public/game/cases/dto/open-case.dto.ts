import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class OpenCaseHttpDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? 1
      : typeof value === 'string'
        ? parseInt(value, 10)
        : value,
  )
  quantity?: number;
}
