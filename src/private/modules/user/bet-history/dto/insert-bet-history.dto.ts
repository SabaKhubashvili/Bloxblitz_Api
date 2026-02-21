import { GameStatus, GameType } from '@prisma/client';
import { Type } from 'class-transformer';
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
  ValidateNested,
  IsDefined,
  IsOptional,
} from 'class-validator';
import { TwoDecimalPlacesRegex } from 'src/class-validator/TwoDecimalPlacesRegex.validator';
class MinesGameDataDto {
  @IsInt({ each: true })
  revealedTiles: number[];

  @IsInt({ each: true })
  minesPositions: number[];
}

class MinesGameConfigDto {
  @IsInt()
  gridSize: number;

  @IsInt()
  minesCount: number;
}
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

  @IsEnum(GameStatus)
  status: GameStatus;

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
  @IsOptional()
  seedRotationHistoryId?: string | null;

  // ─── Timing ───────────────────────────────────────────

  @IsDateString()
  startedAt: string;

  // ─── Payloads ─────────────────────────────────────────

  @IsDefined()
  @ValidateNested()
  @Type(() => MinesGameDataDto)
  gameData: MinesGameDataDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => MinesGameConfigDto)
  gameConfig: MinesGameConfigDto;
}
