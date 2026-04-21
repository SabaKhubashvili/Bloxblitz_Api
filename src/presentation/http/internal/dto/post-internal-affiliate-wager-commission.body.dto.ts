import { Type } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import type { AffiliateWagerCommissionJobGame } from '../../../../application/user/affiliate/dto/affiliate-wager-commission.job.dto';

const INTERNAL_AFFILIATE_GAMES: readonly AffiliateWagerCommissionJobGame[] = [
  'DICE',
  'MINES',
  'CASE',
  'TOWERS',
  'CRASH',
  'ROULETTE',
  'COINFLIP',
  'JACKPOT',
] as const;

export class PostInternalAffiliateWagerCommissionBodyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  bettorUsername!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wagerAmount!: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  sourceEventId!: string;

  @IsString()
  @IsIn(INTERNAL_AFFILIATE_GAMES as unknown as string[])
  game!: AffiliateWagerCommissionJobGame;
}
