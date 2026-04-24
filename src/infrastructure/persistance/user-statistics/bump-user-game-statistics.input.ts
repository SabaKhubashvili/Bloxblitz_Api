import { GameType } from '@prisma/client';

/**
 * One completed game outcome for per-user, per-`gameType` aggregates (`UserGameStatistics`).
 */
export type BumpUserGameStatisticsInput = {
  username: string;
  gameType: GameType;
  stake: number;
  won: boolean;
  netProfit: number;
  playedAt: Date;
};
