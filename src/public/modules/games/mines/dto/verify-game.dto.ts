import {
  IsInt,
  IsString,
  Min,
  Max,
  IsNotEmpty,
  Length,
  Matches,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyMinesGameDto {
  @ApiProperty({
    description: 'Server seed revealed after game completion',
    example: 'a3f2b8c9d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0',
    minLength: 32,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty({ message: 'Server seed is required' })
  @Length(32, 128, {
    message: 'Server seed must be between 32 and 128 characters',
  })
  @Matches(/^[a-fA-F0-9]+$/, {
    message: 'Server seed must be a valid hexadecimal string',
  })
  serverSeed: string;

  @ApiProperty({
    description: 'Client seed provided by the player',
    example: 'my-random-seed-123',
    minLength: 1,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty({ message: 'Client seed is required' })
  @Length(1, 128, {
    message: 'Client seed must be between 1 and 128 characters',
  })
  clientSeed: string;

  @ApiProperty({
    description: 'Game nonce (round number)',
    example: 42,
    minimum: 0,
  })
  @Type(() => Number)
  @IsInt({ message: 'Nonce must be an integer' })
  @Min(0, { message: 'Nonce must be non-negative' })
  nonce: number;

  @ApiProperty({
    description: 'Number of mines in the game',
    example: 5,
    minimum: 1,
    maximum: 24,
  })
  @Type(() => Number)
  @IsInt({ message: 'Mines must be an integer' })
  @Min(1, { message: 'Minimum 1 mine required' })
  @Max(24, { message: 'Maximum 24 mines allowed' })
  mines: number;

  @ApiProperty({
    description: 'Grid size (16 or 25 tiles)',
    example: 25,
    enum: [16, 25],
  })
  @Type(() => Number)
  @IsInt({ message: 'Grid size must be an integer' })
  @IsIn([16, 25], { message: 'Grid size must be either 16 or 25' })
  gridSize: 16 | 25;


  get isValidMineCount(): boolean {
    if (this.gridSize === 16) {
      return this.mines >= 1 && this.mines <= 15;
    }
    if (this.gridSize === 25) {
      return this.mines >= 1 && this.mines <= 24;
    }
    return false;
  }
}