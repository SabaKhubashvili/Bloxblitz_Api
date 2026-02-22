import { GameStatus, GameType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
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

export class CrashGameConfigDto {
  @IsNumber()
  @Min(1)
  maxMultiplier: number;

  @IsNumber()
  @Min(0)
  houseEdge: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  autoCashoutAt?: number;

  @IsString()
  @IsNotEmpty()
  roundId: string;
}

export class MinesGameDataDto {
  @IsInt({ each: true })
  revealedTiles: number[];

  @IsInt({ each: true })
  minesPositions: number[];
}

export class MinesGameConfigDto {
  @IsInt()
  gridSize: number;

  @IsInt()
  minesCount: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  nonce:number
}

type GameDataDto = MinesGameDataDto;
type GameConfigDto = MinesGameConfigDto | CrashGameConfigDto;

export class InsertBetHistoryDto {
  // ─── Identity ─────────────────────────────────────────

  @IsString()
  @IsNotEmpty()
  username: string;


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
  @IsOptional()
  @Min(0)
  @Max(1001)
  finalMultiplier?: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)
  @IsOptional()
  @Min(0)
  payout?: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Validate(TwoDecimalPlacesRegex)

  @IsOptional()
  profit?: number;


  // ─── Timing ───────────────────────────────────────────

  @IsDateString()
  startedAt: string;

  // ─── Payloads ─────────────────────────────────────────

  @IsDefined()
  @ValidateNested()
  @IsOptional()
  @Type(() => Object) // Required for nested validation
  @Transform(({ obj }) => {
    // obj = parent InsertBetHistoryDto
    if (obj.gameType === GameType.MINES) {
      return Object.assign(new MinesGameDataDto(), obj.gameData);
    }
    // You can add other game types here in the future
    return obj.gameData;
  })
  gameData: GameDataDto;

  @ValidateNested()
  @Type(() => Object)
  @Transform(({ obj }) => {
    if (obj.gameType === GameType.CRASH)
      return Object.assign(new CrashGameConfigDto(), obj.gameConfig);
    if (obj.gameType === GameType.MINES)
      return Object.assign(new MinesGameConfigDto(), obj.gameConfig);
    return obj.gameConfig;
  })
  gameConfig: GameConfigDto;
}
