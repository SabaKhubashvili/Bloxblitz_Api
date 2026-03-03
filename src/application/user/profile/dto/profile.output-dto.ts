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
