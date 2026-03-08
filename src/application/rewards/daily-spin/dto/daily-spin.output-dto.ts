export interface SpinResultOutputDto {
  readonly prizeLabel: string;
  readonly prizeAmount: number;
  readonly prizeTier: number;
  readonly nextSpinAt: Date;
}

export interface DailySpinStatusOutputDto {
  readonly canSpin: boolean;
  readonly nextSpinAt: Date | null;
  readonly currentTier: number;
  readonly minLevelRequired: number;
}

export interface DailySpinHistoryItemDto {
  readonly id: string;
  readonly prizeLabel: string;
  readonly prizeAmount: number;
  readonly prizeTier: number;
  readonly spunAt: Date;
}

export interface DailySpinHistoryOutputDto {
  readonly items: readonly DailySpinHistoryItemDto[];
  readonly page: number;
  readonly limit: number;
}
