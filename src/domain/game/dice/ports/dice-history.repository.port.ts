export interface DiceHistoryRecord {
  id: string;
  username: string;
  betAmount: number;
  chance: number;
  rollMode: 'OVER' | 'UNDER';
  rollResult: number;
  multiplier: number;
  payout: number;
  profit: number;
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;
  createdAt: Date;
}

export interface DiceBetToSave {
  id: string;
  username: string;
  betAmount: number;
  chance: number;
  rollMode: 'OVER' | 'UNDER';
  rollResult: number;
  multiplier: number;
  payout: number;
  profit: number;
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;
}

export interface DiceHistoryPage {
  items: DiceHistoryRecord[];
  total: number;
}

export type DiceHistorySortOrder = 'desc' | 'asc';

export interface IDiceHistoryRepository {
  findPageByUsername(
    username: string,
    page: number,
    limit: number,
    order: DiceHistorySortOrder,
  ): Promise<DiceHistoryPage>;

  saveBet(bet: DiceBetToSave): Promise<void>;
}
