import { Side } from "@prisma/client";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { type PlayerInterface } from "src/types/jackpot.interface";

/* ---------- Nested DTOs ---------- */

class CoinflipVerificationDto {
  @IsString()
  @IsNotEmpty()
  serverSeed: string;
  @IsString()
  @IsNotEmpty()
  serverSeedHash: string;


  @IsNumber()
  @IsNotEmpty()
  nonce: number;

  @IsNumber()
  @Min(0)
  eosBlockNumber: number;

  @IsString()
  @IsNotEmpty()
  eosBlockId: string;

  @IsString()
  @IsNotEmpty()
  result: string;
}

/* ---------- Main DTO ---------- */

export class SaveCoinflipGameDto {
  @IsString()
  @IsNotEmpty()
  gameId: string;

  @IsString()
  @MaxLength(64)
  mainPlayer: string;

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
