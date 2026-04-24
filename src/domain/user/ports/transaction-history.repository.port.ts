// ─── Value types ─────────────────────────────────────────────────────────────

/**
 * A single transaction record as understood by the domain.
 * All Prisma/Decimal types are resolved to primitives before reaching this
 * boundary — the domain layer has no knowledge of the database schema.
 */
export interface TransactionRecord {
  readonly id: string;

  readonly userUsername: string;

  /** CRYPTO | KINGUIN_REDEEM | PET | REFUND */
  readonly category: string;

  /** IN (credit) | OUT (debit) */
  readonly direction: string;

  /** KINGUIN | UNIWIRE | INGAME */
  readonly provider: string;

  /** PENDING | COMPLETED | FAILED | CANCELED */
  readonly status: string;

  readonly usdAmountPaid: number;
  readonly cryptoAmountPaid: number;

  /** In-game coin amount — the human-facing value. */
  readonly coinAmountPaid: number;

  /** User's balance immediately after this transaction was settled. */
  readonly balanceAfter: number;

  /** CRYPTO | GIFT_CARD | ITEM */
  readonly assetType: string;

  /** e.g. "BTC", "ETH". Null for gift cards and items. */
  readonly assetSymbol: string | null;

  /** CRYPTO_TRANSACTION | KINGUIN_CODE | INVENTORY_ITEM | GAME_HISTORY | TIP_TRANSACTION */
  readonly referenceType: string;

  /** ID of the source record that triggered this transaction. */
  readonly referenceId: string;

  readonly metadata: Record<string, unknown> | null;

  readonly createdAt: Date;
}

/**
 * Paginated slice of a user's transaction history.
 */
export interface TransactionPage {
  readonly items: TransactionRecord[];
  readonly total: number;
}

export type TransactionHistorySortOrder = 'desc' | 'asc';

/**
 * Filters accepted by `findPageByUsername`.
 * Every field is optional — omitting all fields returns the unfiltered history.
 */
export interface TransactionHistoryFilters {
  /** Restrict to a single transaction category. */
  readonly category?: string;

  /** Restrict to IN (credits) or OUT (debits). */
  readonly direction?: string;

  /** Restrict to a settlement status. */
  readonly status?: string;

  /** Restrict to an asset type. */
  readonly assetType?: string;

  /**
   * Inclusive lower bound for `createdAt`.
   * Pass a `Date` — parsing from ISO-8601 string is done in the application layer.
   */
  readonly from?: Date;

  /** Inclusive upper bound for `createdAt`. */
  readonly to?: Date;
}

// ─── Port (repository interface) ─────────────────────────────────────────────

export interface ITransactionHistoryRepository {
  /**
   * Returns a paginated, filtered slice of a single user's transaction history.
   * Results are ordered by `createdAt` according to `order`.
   *
   * Authorization note: callers must pass the authenticated `username` —
   * this method never cross-queries users.
   */
  findPageByUsername(
    username: string,
    page: number,
    limit: number,
    order: TransactionHistorySortOrder,
    filters: TransactionHistoryFilters,
  ): Promise<TransactionPage>;

  /**
   * Fetches a single transaction by ID, enforcing ownership.
   * Returns `null` when no transaction exists for that `(id, username)` pair.
   */
  findByIdAndUsername(
    id: string,
    username: string,
  ): Promise<TransactionRecord | null>;

  /**
   * Persists a new transaction record.
   * Called internally by infrastructure services — never via a public HTTP route.
   *
   * Returns the newly created record (with the generated `id` and `createdAt`).
   */
  create(
    data: Omit<TransactionRecord, 'id' | 'createdAt'>,
  ): Promise<TransactionRecord>;
}
