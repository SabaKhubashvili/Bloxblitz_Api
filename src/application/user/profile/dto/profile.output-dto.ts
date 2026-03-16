import { UserRoles } from "@prisma/client";

export interface ProfileStatisticsDto {
  readonly totalDeposits: string;
  readonly totalWithdrawals: string;
  readonly totalProfit: string;
  readonly totalLoss: string;
  readonly totalWagered: string;
  readonly wagerLast7Days: number;
  readonly wagerLast30Days: number;
}

export interface ProfileSettingsDto {
  readonly privateProfile: boolean;
}

export interface ProfileOutputDto {
  readonly id: string;
  readonly username: string;
  readonly profile_picture: string;
  readonly created_at: string;
  readonly totalXp: number;
  readonly currentLevel: number;
  readonly xpNeededForNextLevel: number;
  readonly xpPercentage: number;
  readonly statistics: ProfileStatisticsDto;
  readonly settings: ProfileSettingsDto;
}

export interface PublicProfileStatisticsDto {
  readonly totalWagered: number;
  readonly totalGamesWon: number;
  readonly biggestWin: number;
  readonly totalGamesPlayed: number;
}

export interface PublicProfileOutputDto {
  readonly id: string;
  readonly username: string;
  readonly role: UserRoles;
  readonly currentLevel: number;
  readonly totalXP: number;
  readonly progressPercentage: number;
  readonly xpNeededForNextLevel: number;
  readonly profile_picture: string;
  readonly created_at: string;
  readonly statistics: PublicProfileStatisticsDto;
  readonly leaderboardRank: number;
  readonly winRate: string;
  readonly isOnline: boolean;
  readonly privateProfile: false;
}
export interface PrivateProfileOutputDto {
  readonly privateProfile: true;
  readonly username: string;
  readonly profile_picture: string;
  readonly currentLevel: number;
  readonly totalXP: number;
  readonly progressPercentage: number;
  readonly xpNeededForNextLevel: number;
}