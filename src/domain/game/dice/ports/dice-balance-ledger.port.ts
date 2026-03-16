/**
 * Dice balance ledger port — atomic bet placement and payout settlement.
 *
 * Dice is an instant game: one roll = one bet = one result.
 * The ledger handles:
 *  - placeBet: deduct bet, increment nonce, return nonce for roll generation
 *  - settlePayout: credit winnings (or nothing on loss — bet already deducted)
 */
export interface PlaceDiceBetParams {
  username: string;
  betAmount: number;
}

export interface PlaceDiceBetResult {
  success: boolean;
  nonce?: number;
  balanceAfter?: number;
  error?: 'INSUFFICIENT_BALANCE' | 'REDIS_ERROR';
}

export interface SettleDicePayoutParams {
  username: string;
  profit: number;
}

export interface IDiceBalanceLedgerPort {
  /**
   * Atomically deduct bet, increment nonce.
   * Seeds Redis from DB if balance key is absent.
   */
  placeBet(params: PlaceDiceBetParams): Promise<PlaceDiceBetResult>;

  /**
   * Credit profit to user's balance (win case).
   * On loss, profit is 0 — no credit needed.
   */
  settlePayout(params: SettleDicePayoutParams): Promise<void>;
}
