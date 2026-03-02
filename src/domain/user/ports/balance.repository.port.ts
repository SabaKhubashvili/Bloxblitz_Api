/**
 * The shape of a user's balance record returned from persistent storage.
 * Both values are already rounded to 2 decimal places by the repository.
 */
export interface UserBalanceRecord {
  /** Game (coin) balance — the primary spendable currency. */
  balance: number;
  /** Aggregate value of all available inventory items. */
  petValueBalance: number;
}

/**
 * Persistent-storage contract for user balance.
 * Implementations live in the infrastructure layer.
 */
export interface IBalanceRepository {
  /**
   * Returns the balance record for the given username,
   * or null if the user does not exist.
   */
  findBalanceByUsername(username: string): Promise<UserBalanceRecord | null>;
}
