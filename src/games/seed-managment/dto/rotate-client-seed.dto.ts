import { IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class RotateClientSeedDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  newClientSeed: string;
}
