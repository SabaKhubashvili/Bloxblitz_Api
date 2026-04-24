import { GameType } from '@prisma/client';

export type BumpGlobalUserStatisticsInput = {
  username: string;
  gameType: GameType;
  stake: number;
  netProfit: number;
  won: boolean;
  playedAt: Date;
  multiplier?: number;
  crashPoint?: number;
};
