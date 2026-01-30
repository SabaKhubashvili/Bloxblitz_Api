import { GameOutcome, GameType } from '@prisma/client';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsObject,
  IsNotEmpty,
  Validate,
} from 'class-validator';
import { TwoDecimalPlacesRegex } from 'src/class-validator/TwoDecimalPlacesRegex.validator';

export class InsertBetHistoryDto {
  // ─── Identity ─────────────────────────────────────────

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsEnum(GameType)
  gameType: GameType;

  // ─── Bet Data ─────────────────────────────────────────

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)
  @Min(0.01)
  betAmount: number;

  @IsEnum(GameOutcome)
  outcome: GameOutcome;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)
  @Min(0)
  finalMultiplier: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)
  @Min(0)
  payout: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)
  @Min(0)
  profit: number;

  // ─── Provably Fair ────────────────────────────────────

  @IsString()
  serverSeedHash: string;

  @IsString()
  @IsNotEmpty()
  clientSeed: string;

  @IsInt()
  @Min(0)
  nonce: number;

  // ─── Timing ───────────────────────────────────────────

  @IsDateString()
  startedAt: string;

  // ─── Payloads ─────────────────────────────────────────

  @IsObject()
  gameConfig: Record<string, any>;

  @IsObject()
  gameData: Record<string, any>;
}
