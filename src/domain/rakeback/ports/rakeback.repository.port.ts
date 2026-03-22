import type { Rakeback } from '../entities/rakeback.entity';
import type { RakebackType } from '../enums/rakeback-type.enum';

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

  /**
   * Loss-based rakeback: updates eligible wager/won, reapplies pool accrual from net-loss deltas,
   * enforces daily positive accrual cap (UTC). Call only for bets ≥ MIN_RAKEBACK_BET.
   */
  applyBetResolutionForRakeback(params: {
    username: string;
    userLevel: number;
    eligibleWagerDelta: number;
    eligibleWonDelta: number;
  }): Promise<void>;

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
