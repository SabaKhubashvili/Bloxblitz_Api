import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum SortOrder {
  DESC = 'desc',
  ASC = 'asc',
}

export enum GameTypeFilter {
  MINES = 'MINES',
  CRASH = 'CRASH',
  COINFLIP = 'COINFLIP',
}

export class BetHistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Sort direction for `createdAt`.
   * - `desc` (default) — latest bets first
   * - `asc` — oldest bets first
   */
  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder = SortOrder.DESC;

  /**
   * Optional filter by game type.
   * - `MINES` — Mines game bets only
   * - `CRASH` — Crash game bets only
   * - `COINFLIP` — Coinflip game bets only
   */
  @IsOptional()
  @IsEnum(GameTypeFilter)
  gameType?: GameTypeFilter;
}
