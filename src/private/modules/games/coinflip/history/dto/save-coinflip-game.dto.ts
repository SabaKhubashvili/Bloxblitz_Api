import { Side } from "@prisma/client";
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

/* ---------- Nested DTOs ---------- */
class PlayerInterface {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @MinLength(3)
  username: string;
  @IsString()
  @IsNotEmpty()
  profilePicture: string;
  @IsNumber()
  @IsNotEmpty()
  level: number;
  @IsString()
  @IsNotEmpty()
  betAmount: string;
  @IsEnum(['H', 'T'])
  @IsNotEmpty()
  side: 'H' | 'T';
}
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
  @Type(() => PlayerInterface)
  player1: PlayerInterface;

  @IsObject()
  @ValidateNested()
  @Type(() => PlayerInterface)
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
