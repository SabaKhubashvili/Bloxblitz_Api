import { TransactionHistorySortOrder } from "src/domain/user/ports/transaction-history.repository.port";

/**
 * Internal use-case input for fetching a paginated transaction history.
 * Constructed by the controller from the validated HTTP query DTO and the
 * authenticated user's JWT payload.
 */
export interface GetTransactionHistoryQuery {
  /** Authenticated user — injected from JWT, never from the request body. */
  readonly username: string;

  readonly page:  number;
  readonly limit: number;

  /** Sort direction for `createdAt`. Defaults to `'desc'` (newest first). */
  readonly order: TransactionHistorySortOrder;

  /** Optional filter by `TransactionCategory` (CRYPTO, KINGUIN_REDEEM, PET, REFUND). */
  readonly category?: string;

  /** Optional filter by flow direction (IN | OUT). */
  readonly direction?: string;

  /** Optional filter by settlement status (PENDING | COMPLETED | FAILED | CANCELED). */
  readonly status?: string;

  /** Optional filter by asset type (CRYPTO | GIFT_CARD | ITEM). */
  readonly assetType?: string;

  /** Optional ISO-8601 lower bound for `createdAt`. */
  readonly from?: string;

  /** Optional ISO-8601 upper bound for `createdAt`. */
  readonly to?: string;
}
