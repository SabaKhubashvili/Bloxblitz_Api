import {
  IsBoolean,
  IsNumber,
  IsString,
  MaxLength,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserStatisticsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  username: string;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  bet: number;

  @IsBoolean()
  isWinner: boolean;

  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  winAmount: number;
}
