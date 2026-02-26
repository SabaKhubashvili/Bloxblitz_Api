import { GameType } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from "class-validator";
import { Type } from "class-transformer";

export class AddUserXpDto {
  @IsString()
  @MaxLength(32)
  username: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  betAmount: number;

  @IsEnum(GameType)
  gameType: GameType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceId?: string;
}
