import { Variant } from '@prisma/client';
import { 
  IsInt, 
  IsPositive, 
  IsDate, 
  IsEnum, 
  IsArray, 
  ArrayMinSize, 
  IsOptional, 
  Min, 
  IsNotEmpty,
  ValidateNested,
  IsNumber
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddNewGiveawayDto {
  @IsInt({ message: 'Pet ID must be an integer' })
  @IsPositive({ message: 'Pet ID must be positive' })
  @IsNotEmpty({ message: 'Pet ID is required' })
  petId: number;

  @IsNumber({}, { message: 'Value must be a number' })
  @IsPositive({ message: 'Value must be positive' })
  @IsNotEmpty({ message: 'Value is required' })
  value: number;

  @Type(() => Date)
  @IsDate({ message: 'End date must be a valid date' })
  @IsNotEmpty({ message: 'End date is required' })
  endDate: Date;

  @IsOptional()
  @IsNumber({}, { message: 'Minimum wager must be a number' })
  @Min(0, { message: 'Minimum wager cannot be negative' })
  minWager?: number;

  @IsArray({ message: 'Variant must be an array' })
  @ArrayMinSize(1, { message: 'At least one variant is required' })
  @IsEnum(Variant, { each: true, message: 'Each variant must be a valid Variant value' })
  @IsNotEmpty({ message: 'Variants are required' })
  variant: Variant[];
}