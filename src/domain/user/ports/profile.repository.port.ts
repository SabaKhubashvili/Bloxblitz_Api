import { Decimal } from "@prisma/client/runtime/client";

export interface UserProfileRecord {
  id: string;
  username: string;
  profile_picture: string;
  created_at: Date;
  totalXP: number;
  currentLevel: number;
  statistics: {
    totalDeposits: Decimal;
    totalWithdrawals: Decimal;
    totalProfit: Decimal;
    totalLoss: Decimal;
    totalWagered: Decimal;
    totalGamesWon: number;
    biggestWin: Decimal;
    totalGamesPlayed: number;
  } | null;
  settings: {
    privateProfile: boolean;
  } | null;
}

export interface IProfileRepository {
  findByUsername(username: string): Promise<UserProfileRecord | null>;
  getLeaderboardRank(username: string): Promise<number>;
  sumWagerSince(username: string, since: Date): Promise<number>;
  updatePrivateProfile(
    username: string,
    privateProfile: boolean,
  ): Promise<{ privateProfile: boolean }>;
}
