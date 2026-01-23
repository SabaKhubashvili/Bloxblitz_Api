import { IsArray, IsEnum, IsNotEmpty, IsString, ArrayNotEmpty, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum ItemState {
  IDLE = 'IDLE',
  BATTLING = 'BATTLING',
}

// DTO for each batch item
export class BatchItemDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(1, { each: true })
  items: number[];
}

export class BatchUpdateItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true }) // ensures validation of nested objects
  @Type(() => BatchItemDto) // needed for class-transformer to work
  batch: BatchItemDto[];

  @IsEnum(ItemState)
  newState: ItemState;
}
