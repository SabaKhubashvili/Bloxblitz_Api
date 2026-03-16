/**
 * Uniwire domain types.
 *
 * These represent Uniwire API concepts in domain terms. Snake_case fields
 * (e.g. rate_usd) mirror the external API; map to camelCase in adapters if needed.
 */

import { AvailableCryptos } from "@prisma/client";

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

// ── Invoice (Get Invoice) ────────────────────────────────────────────────────

export interface UniwireInvoiceAmountItem {
  readonly amount: string;
  readonly currency: string;
}

export interface UniwireInvoiceAmount {
  readonly requested: UniwireInvoiceAmountItem;
  readonly invoiced: UniwireInvoiceAmountItem;
  readonly paid: UniwireInvoiceAmountItem | null;
}
export interface UniwireInvoiceResult {
  readonly currency: AvailableCryptos;
  readonly address: string;
}

export interface UniwireGetInvoiceResponse {
  readonly result:{
    readonly id: string;
    readonly kind: string;
    readonly created_at: string;
    readonly profile_id: string;
    readonly address: string;
    readonly lightning: string | null;
    readonly network: string;
    readonly status: string;
    readonly amount: UniwireInvoiceAmount;
    readonly custom_fee: unknown | null;
    readonly min_confirmations: number | null;
    readonly zero_conf_enabled: boolean | null;
    readonly notes: string | null;
    readonly passthrough: string | null;
    readonly transactions: readonly unknown[];
  }
}

// ── Create deposit address (per-currency) ─────────────────────────────────────

export interface UniwireCreateDepositAddressResponse {
  readonly address: string;
  readonly network: string;
  readonly profileId: string;
  readonly invoiceId?: string;
}