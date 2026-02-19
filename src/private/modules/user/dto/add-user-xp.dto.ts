import { GameType } from "@prisma/client";
import { IsEnum, IsNumber, IsPositive, IsString, MaxLength } from "class-validator";
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
}
