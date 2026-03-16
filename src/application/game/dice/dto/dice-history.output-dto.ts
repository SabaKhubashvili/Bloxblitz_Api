export interface DiceHistoryItemOutputDto {
  id: string;
  rollResult: number;
  betAmount: number;
  payout: number;
  multiplier: number;
  profit: number;
  chance: number;
  rollMode: 'OVER' | 'UNDER';
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;
  createdAt: string;
}

export interface DiceHistoryOutputDto {
  items: DiceHistoryItemOutputDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
