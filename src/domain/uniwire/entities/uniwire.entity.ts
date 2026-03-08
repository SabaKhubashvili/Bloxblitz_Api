/**
 * Uniwire domain types.
 *
 * These represent Uniwire API concepts in domain terms. Snake_case fields
 * (e.g. rate_usd) mirror the external API; map to camelCase in adapters if needed.
 */

// ── Exchange rates ────────────────────────────────────────────────────────────

export interface UniwireExchangeRate {
  readonly id: string;
  readonly kind: string;
  readonly symbol: string;
  readonly rate_usd: number;
  readonly rate_btc: string;
  readonly sign: string;
}

export interface UniwireExchangeRates {
  readonly result: readonly UniwireExchangeRate[];
}

// ── Payout ────────────────────────────────────────────────────────────────────

export interface UniwireCreatePayoutResponse {
  readonly payoutId: string;
  readonly status: string;
}

// ── Transaction ──────────────────────────────────────────────────────────────

export interface UniwireRecentTransaction {
  readonly coinAmountPaid: number;
  readonly cryptoAmountPaid: number;
  readonly confirmations: number;
  readonly minConfirmations: number;
  readonly isFullyConfirmed: boolean;
  readonly txid: string;
}

// ── Coin address ─────────────────────────────────────────────────────────────

export interface UniwireGetCoinAddressResponse {
  readonly address: string;
  readonly recentTransactions: readonly UniwireRecentTransaction[];
}