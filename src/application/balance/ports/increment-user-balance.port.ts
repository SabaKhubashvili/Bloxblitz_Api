/**
 * Port for crediting an arbitrary amount to a user's balance.
 *
 * Implementations live in the infrastructure layer (Redis / DB adapters).
 * This interface keeps the application layer free of concrete cache or
 * persistence technology.
 */
export interface IIncrementUserBalancePort {
  /**
   * Atomically adds `amount` to the user's live balance.
   *
   * @param username - The user's unique username.
   * @param amount   - A positive, finite number of coins to credit.
   *                   Implementations MUST reject non-positive values.
   */
  increment(username: string, amount: number): Promise<void>;
}
