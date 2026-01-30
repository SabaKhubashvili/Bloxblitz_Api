import { IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export enum ReferralSource {
  COINFLIP = 'Coinflip',
  MINES = 'Mines',
  CRASH = 'Crash',
  OTHER = 'Other',
}

export class IncrementReferralEarnedDto {
  @IsString()
  referredUsername: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(ReferralSource)
  source: ReferralSource;

  @IsOptional()
  @IsString()
  metadata?: string;
}
