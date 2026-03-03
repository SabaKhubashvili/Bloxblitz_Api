import type { RakebackTypeInfo } from '../../../../domain/rakeback/entities/rakeback.entity.js';

export interface RakebackDataOutputDto {
  daily: RakebackTypeInfo;
  weekly: RakebackTypeInfo;
  monthly: RakebackTypeInfo;
}

export interface ClaimResultOutputDto {
  type: string;
  amountClaimed: number;
  streak: number;
  streakPercent: number;
  streakReset: boolean;
  newBalance: number;
  nextClaimAvailableAt: Date;
}
