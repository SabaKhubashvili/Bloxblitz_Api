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
  } | null;
  settings: {
    privateProfile: boolean;
  } | null;
}

export interface IProfileRepository {
  findByUsername(username: string): Promise<UserProfileRecord | null>;
  sumWagerSince(username: string, since: Date): Promise<number>;
  updatePrivateProfile(
    username: string,
    privateProfile: boolean,
  ): Promise<{ privateProfile: boolean }>;
}
