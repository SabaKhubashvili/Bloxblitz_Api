export interface BetHistoryItemOutputDto {
  id: string;
  gameType: string;
  status: string;
  betAmount: number;
  profit: number | null;
  multiplier: number | null;
  createdAt: string;
  /** Game-specific data (mines config, crash cashout, coinflip players, etc.) */
  gameData: Record<string, unknown> | null;
}

export interface BetHistoryOutputDto {
  items: BetHistoryItemOutputDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
