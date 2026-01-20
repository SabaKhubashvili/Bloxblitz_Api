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
  IsOptional,
  Validate,
} from 'class-validator';
import { TwoDecimalPlacesRegex } from 'src/class-validator/TwoDecimalPlacesRegex.validator';

export class UpdateBetHistoryDto {

  // ─── Identifier (required) ────────────────────────────

  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsEnum(GameType)
  gameType?: GameType;

  // ─── Optional Bet Data ───────────────────────────────

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)
  @Min(0.01)
  betAmount?: number;

  @IsOptional()
  @IsEnum(GameOutcome)
  outcome?: GameOutcome;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)
  @Min(0)
  finalMultiplier?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)
  @Min(0)
  payout?: number;

  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)
  @Min(-3000)
  profit?: number;

  // ─── Optional Provably Fair ──────────────────────────

  @IsOptional()
  @IsString()
  serverSeedHash?: string;

  @IsOptional()
  @IsString()
  clientSeed?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  nonce?: number;

  // ─── Optional Timing ─────────────────────────────────

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsNumber()
  duration?: number;

  // ─── Optional Payloads ───────────────────────────────

  @IsOptional()
  @IsObject()
  gameConfig?: Record<string, any>;

  @IsOptional()
  @IsObject()
  gameData?: Record<string, any>;
}
