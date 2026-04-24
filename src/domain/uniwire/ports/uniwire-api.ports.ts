import { AvailableCryptos } from '@prisma/client';
import type {
  UniwireExchangeRates,
  UniwireCreatePayoutResponse,
  UniwireGetInvoiceResponse,
  UniwireRecentTransaction,
  UniwireCreateDepositAddressResponse,
} from '../entities/uniwire.entity';

/**
 * Port for Uniwire external API.
 * Implementations live in the infrastructure layer (e.g. UniwireApiAdapter).
 */
export interface IUniwireApiPort {
  /** Fetch current exchange rates. */
  getExchangeRates(): Promise<UniwireExchangeRates>;

  /** Create a payout. Returns payout id and status. */
  createPayout(
    params: CreatePayoutParams,
  ): Promise<UniwireCreatePayoutResponse>;

  /** Get transaction confirmations by transaction id(s). */
  getTransactionConfirmations(
    ids: string[],
  ): Promise<UniwireRecentTransaction[]>;

  /** Get coin address and recent transactions for a profile. */
  getInvoiceAddress(
    profileId: string,
    currency: AvailableCryptos,
  ): Promise<UniwireGetInvoiceResponse>;

  /** Create an invoice. */
  createInvoice(
    params: CreateInvoiceParams,
  ): Promise<UniwireGetInvoiceResponse>;

  /** Generate a new deposit address for a currency. Uses profileId from config. */
  createDepositAddress(
    currency: AvailableCryptos,
    passthrough: Record<string, string>,
  ): Promise<UniwireCreateDepositAddressResponse>;
}
export enum UniwireInvoiceKind {
  BTC = 'BTC',
  Ethereum = 'ETH',
  Litecoin = 'LTC',
  USDT = 'ETH_USDT',
  DOGE = 'DOGE',
}

export interface CreatePayoutParams {
  profileId: string;
  /** Must be unique per payout (Uniwire idempotency / tracking). */
  referenceId: string;
  /**
   * Stringified JSON object, e.g. `JSON.stringify({ user_id: 1 })` — required by some Uniwire environments.
   */
  passthrough: string;
  kind: string;
  recipients: Array<{
    amount: string;
    currency: string;
    address: string;
    /** Optional; shown in provider / reconciliation. */
    notes?: string;
  }>;
}

export interface CreateInvoiceParams {
  profile_id: string;
  currency: string;
  kind: UniwireInvoiceKind;
  passthrough?: Record<string, string>;
  amount?: number;
}

export interface CreateInvoiceResult {
  readonly invoiceId: string;
  readonly status: string;
  readonly address?: string;
}
