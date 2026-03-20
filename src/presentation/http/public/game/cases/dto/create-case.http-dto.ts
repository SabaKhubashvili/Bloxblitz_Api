import { CaseVariant, Variant } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCaseItemHttpDto {
  @IsInt()
  @Min(1)
  petId!: number;

  @IsInt()
  @Min(1)
  weight!: number;

  @IsInt()
  sortOrder!: number;

  @IsOptional()
  @IsArray()
  @IsEnum(Variant, { each: true })
  variant?: Variant[];
}

export class CreateCaseHttpDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  imageUrl?: string | null;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsEnum(CaseVariant)
  variant!: CaseVariant;

  @IsNumber()
  @Min(0)
  @Max(100)
  riskLevel!: number;

  @IsBoolean()
  isActive!: boolean;

  @IsInt()
  sortOrder!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCaseItemHttpDto)
  items!: CreateCaseItemHttpDto[];
}
