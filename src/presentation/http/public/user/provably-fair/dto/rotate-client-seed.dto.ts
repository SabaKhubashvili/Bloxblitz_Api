import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RotateClientSeedDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'clientSeed must not be empty when provided' })
  @MaxLength(64, { message: 'clientSeed must not exceed 64 characters' })
  clientSeed?: string;
}
