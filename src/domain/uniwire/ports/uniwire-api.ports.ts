import type {
  UniwireExchangeRates,
  UniwireCreatePayoutResponse,
  UniwireGetCoinAddressResponse,
  UniwireRecentTransaction,
} from '../entities/uniwire.entity';

/**
 * Port for Uniwire external API.
 * Implementations live in the infrastructure layer (e.g. UniwireApiAdapter).
 */
export interface IUniwireApiPort {
  /** Fetch current exchange rates. */
  getExchangeRates(): Promise<UniwireExchangeRates>;

  /** Create a payout. Returns payout id and status. */
  createPayout(params: CreatePayoutParams): Promise<UniwireCreatePayoutResponse>;

  /** Get transaction confirmations by transaction id(s). */
  getTransactionConfirmations(ids: string[]): Promise<UniwireRecentTransaction[]>;

  /** Get coin address and recent transactions for a profile. */
  getCoinAddress(profileId: string): Promise<UniwireGetCoinAddressResponse>;

  /** Create an invoice. */
  createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult>;
}

export interface CreatePayoutParams {
  profileId: string;
  amount: number;
  currency: string;
  kind?: string;
}

export interface CreateInvoiceParams {
  profileId: string;
  currency: string;
  kind: string;
  passthrough?: Record<string, string>;
}

export interface CreateInvoiceResult {
  readonly invoiceId: string;
  readonly status: string;
  readonly address?: string;
}
