export interface XpProgressDto {
  readonly currentLevelXp: number;
  readonly nextLevelXp: number;
  readonly progressPercent: number;
}

export interface LevelProgressOutputDto {
  readonly username: string;
  readonly currentLevel: number;
  readonly totalXp: number;
  readonly tierNumber: number;
  readonly tierName: string;
  readonly xpMultiplier: number;
  readonly xpProgress: XpProgressDto;
  readonly xpEarnedLast24h: number;
  readonly rakebackPercent: string;
}
