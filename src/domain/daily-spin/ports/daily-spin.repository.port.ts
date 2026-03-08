import type { DailySpinState } from '../entities/daily-spin-state.entity';

export interface DailySpinHistoryRecord {
  readonly id: string;
  readonly userUsername: string;
  readonly prizeTier: number;
  readonly prizeAmount: number;
  readonly prizeLabel: string;
  readonly createdAt: Date;
}

export interface SaveSpinData {
  readonly prizeTier: number;
  readonly prizeAmount: number;
  readonly prizeLabel: string;
}

export interface IDailySpinRepository {
  /** Returns the spin state for a user, or null if they have never spun. */
  findStateByUsername(username: string): Promise<DailySpinState | null>;

  /**
   * Atomically upserts the spin state and inserts a history record
   * inside a single Prisma transaction.
   */
  saveSpinWithHistory(state: DailySpinState, data: SaveSpinData): Promise<void>;

  getSpinHistory(
    username: string,
    page: number,
    limit: number,
  ): Promise<DailySpinHistoryRecord[]>;

  /**
   * Sums all non-cancelled bet amounts from GameHistory for this user
   * since the given date, used for wager-tier resolution.
   */
  get30DayWager(username: string, since: Date): Promise<number>;
}
