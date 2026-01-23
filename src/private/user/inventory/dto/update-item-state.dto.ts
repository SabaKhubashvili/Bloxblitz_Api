import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  IsIn,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateItemStateDto {
  @IsString()
  @MaxLength(32)
  @Transform(({ value }) => value.trim())
  @IsOptional()
  username?: string;

  @IsInt({ each: true })
  @Min(1, { each: true })
  itemIds: number[];

  @IsString()
  @IsIn(['IDLE', 'BATTLING'])
  @IsNotEmpty()
  newState: 'IDLE' | 'BATTLING';
}
