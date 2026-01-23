import { IsDateString, IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetCoinflipWagerDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => value.trim())
  username: string;

  @IsDateString()
  @IsNotEmpty()
  gte?: string; // ISO date string
}
