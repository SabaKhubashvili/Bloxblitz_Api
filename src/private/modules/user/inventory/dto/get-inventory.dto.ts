import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
  ArrayNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class GetInventoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Transform(({ value }) => value.trim())
  username: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  itemIds: number[];

  @IsOptional()
  @IsEnum(['IDLE', 'BATTLING', 'LOCKED'] as const)
  state?:'IDLE' | 'BATTLING' | 'LOCKED';

  @IsOptional()
  @IsInt()
  @Min(0)
  valueGte?:number;

  @IsOptional()
  @IsBoolean()
  includePet?:boolean;
}
