import type { Rakeback } from '../entities/rakeback.entity.js';
import type { RakebackType } from '../enums/rakeback-type.enum.js';

export interface ClaimLogData {
  type: RakebackType;
  amountClaimed: number;
  streakDay: number;
  streakBonus: number;
  streakReset: boolean;
  balanceBefore: number;
  balanceAfter: number;
}

export interface IRakebackRepository {
  findByUsername(username: string): Promise<Rakeback | null>;

  /** Creates a default record if none exists and returns it. */
  ensureExists(username: string): Promise<Rakeback>;

  /** Atomic increment of accrued balances. */
  accumulateRakeback(
    username: string,
    daily: number,
    weekly: number,
    monthly: number,
  ): Promise<void>;

  /** Saves the mutated aggregate and creates a claim-log entry in one transaction. */
  saveClaim(rakeback: Rakeback, claimLog: ClaimLogData): Promise<void>;

  /**
   * Batch: moves accrued → claimable for all users and sets the window timestamps.
   * Returns the number of rows updated.
   */
  openClaimWindow(
    type: RakebackType,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<number>;

  /**
   * Batch: resets streak for users who did NOT claim during the current window.
   * Returns the number of rows affected.
   */
  resetMissedStreaks(type: RakebackType): Promise<number>;
}
