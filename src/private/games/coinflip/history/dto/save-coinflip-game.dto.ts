import { Side } from "@prisma/client";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { type PlayerInterface } from "src/coinflip/types/jackpot.interface";

/* ---------- Nested DTOs ---------- */

class CoinflipVerificationDto {
  @IsString()
  @IsNotEmpty()
  serverSeed: string;

  @IsString()
  @IsNotEmpty()
  publicServerSeed: string;

  @IsString()
  @IsNotEmpty()
  clientSeed: string;

  @IsString()
  @IsNotEmpty()
  nonce: string;

  @IsString()
  @IsNotEmpty()
  result: string;

  @IsNumber()
  @Min(0)
  player1Chance: number;

  @IsNumber()
  @Min(0)
  player2Chance: number;
}

/* ---------- Main DTO ---------- */

export class SaveCoinflipGameDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  player1: PlayerInterface;

  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  player2: PlayerInterface;

  @IsEnum(Side)
  winnerSide: Side;

  @IsNumber()
  @Min(0.01)
  betAmount: number;

  @IsObject()
  @ValidateNested()
  @Type(() => CoinflipVerificationDto)
  verificationData: CoinflipVerificationDto;
}
