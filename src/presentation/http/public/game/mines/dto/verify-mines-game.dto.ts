import {
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';

/** Supported grid sizes (total tiles: 4x4=16, 5x5=25, 6x6=36, 8x8=64, 10x10=100) */
const VALID_GRID_SIZES = [16, 25, 36, 64, 100] as const;

export class VerifyMinesGameHttpDto {
  @IsString()
  @IsNotEmpty({ message: 'Server seed is required' })
  serverSeed: string;

  @IsString()
  @IsNotEmpty({ message: 'Client seed is required' })
  clientSeed: string;

  @IsNumber()
  @IsInt()
  @Min(0, { message: 'Nonce must be a non-negative integer' })
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  nonce: number;

  @IsNumber()
  @IsIn(VALID_GRID_SIZES, {
    message: 'Grid size must be 16, 25, 36, 64, or 100 (total tiles)',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  gridSize: (typeof VALID_GRID_SIZES)[number];

  @IsNumber()
  @IsInt()
  @Min(1, { message: 'Mines must be at least 1' })
  @Transform(({ value }) =>
    typeof value === 'string' ? parseInt(value, 10) : value,
  )
  mines: number;
}
