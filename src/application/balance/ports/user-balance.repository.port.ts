export type DecrementBalanceResult =
  | { ok: true }
  | { ok: false; reason: 'invalid_amount' | 'insufficient_funds' };

/**
 * Live user balance mutations (Redis-backed implementation in infrastructure).
 * Single entry surface for credits and atomic debits across the app.
 */
export interface IUserBalanceRepository {
  increment(username: string, amount: number): Promise<void>;

  tryDecrement(
    username: string,
    amount: number,
  ): Promise<DecrementBalanceResult>;
}
