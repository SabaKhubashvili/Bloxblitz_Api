import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  IsIn,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateItemStateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Transform(({ value }) => value.trim())
  username: string;

  @IsInt()
  @Min(1)
  itemId: number;

  @IsString()
  @IsIn(['IDLE', 'BATTLING'])
  @IsNotEmpty()
  newState: 'IDLE' | 'BATTLING';
}
