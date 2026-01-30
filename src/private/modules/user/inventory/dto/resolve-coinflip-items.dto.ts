import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsString,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class CoinflipUserDto {
  @IsString()
  @IsNotEmpty()
  username: string;
}

export class ResolveCoinflipItemsDto {
  @IsObject()
  @ValidateNested()
  @Type(() => CoinflipUserDto)
  winner: CoinflipUserDto;

  @IsObject()
  @ValidateNested()
  @Type(() => CoinflipUserDto)
  loser: CoinflipUserDto;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  winnerItemIds: number[];

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  loserToWinnerIds: number[];

  @IsArray()
  @IsInt({ each: true })
  houseItems: number[];
}
