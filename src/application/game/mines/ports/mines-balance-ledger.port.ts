/**
 * All balance mutations that can occur during the Mines game lifecycle.
 * Using a union type keeps switch-statements exhaustive and the audit log
 * entries self-describing.
 */
export type BalanceAction = 'BET_PLACED' | 'CASHOUT' | 'AUTO_WIN' | 'GAME_LOST';

// ── placeBet ──────────────────────────────────────────────────────────────────

export interface PlaceBetParams {
  username: string;
  /** Raw bet amount in coins (e.g. 10.00). */
  betAmount: number;
  gameId: string;
  /** Serialisable game snapshot to atomically store in Redis alongside the deduction. */
  gameData: Record<string, unknown>;
}

export interface PlaceBetResult {
  success: boolean;
  /** Provably-fair nonce injected by the Lua script. Present only on success. */
  nonce?: number;
  /** User's Redis balance after the deduction. Present only on success. */
  balanceAfter?: number;
  error?: 'ACTIVE_GAME_EXISTS' | 'INSUFFICIENT_BALANCE' | 'REDIS_ERROR';
}

// ── settlePayout ──────────────────────────────────────────────────────────────

export interface SettlePayoutParams {
  username: string;
  gameId: string;
  /** Total amount to credit (bet × multiplier). */
  profit: number;
  /** Distinguishes a manual cashout from an automatic board-clear win. */
  reason: 'CASHOUT' | 'AUTO_WIN';
}

// ── port ──────────────────────────────────────────────────────────────────────

/**
 * Single authority for every balance mutation in the Mines game.
 *
 * Responsibilities:
 *  - Atomicity  — every operation uses a Redis Lua script so it is
 *                 all-or-nothing even under concurrent requests.
 *  - Dirty-flag — after each mutation the username is added to
 *                 `user:balance:dirty` so the BalanceSyncWorker flushes
 *                 the change to PostgreSQL within 2 seconds.
 *  - Audit log  — each mutation appends a compact JSON entry to the
 *                 per-game ledger key `ledger:mines:{gameId}` (TTL 7 d,
 *                 capped at 50 entries) for transparency and debugging.
 */
export interface IMinesBalanceLedgerPort {
  /**
   * Atomically validates the user has no active game and sufficient funds,
   * deducts the bet amount, saves the initial game state to Redis, and
   * marks the balance as dirty for DB sync.
   *
   * Returns the server-assigned nonce and the post-deduction balance on success.
   */
  placeBet(params: PlaceBetParams): Promise<PlaceBetResult>;

  /**
   * Credits profit to the user's live Redis balance, marks the balance
   * dirty, and records the payout in the per-game audit ledger.
   *
   * Called both on explicit cashout and on automatic board-clear win.
   */
  settlePayout(params: SettlePayoutParams): Promise<void>;
}
