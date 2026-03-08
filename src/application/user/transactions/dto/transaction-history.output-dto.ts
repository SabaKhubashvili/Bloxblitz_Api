/**
 * A single transaction record returned to the client.
 * All Prisma/Decimal types are already resolved before this DTO is constructed.
 */
export interface TransactionHistoryItemOutputDto {
  readonly id: string;

  /** CRYPTO | KINGUIN_REDEEM | PET | REFUND */
  readonly category: string;

  /** IN (credit) or OUT (debit) */
  readonly direction: string;

  /** KINGUIN | UNIWIRE | INGAME */
  readonly provider: string;

  /** PENDING | COMPLETED | FAILED | CANCELED */
  readonly status: string;

  /** In-game coin amount (human-facing value). */
  readonly coinAmountPaid: number;

  /** USD value of the transaction (may be 0 for non-crypto types). */
  readonly usdAmountPaid: number;

  /** User's coin balance immediately after this transaction settled. */
  readonly balanceAfter: number;

  /** CRYPTO | GIFT_CARD | ITEM */
  readonly assetType: string;

  /** Asset ticker symbol, e.g. "BTC". Null for gift cards and items. */
  readonly assetSymbol: string | null;

  /** Type of the source record this transaction was created from. */
  readonly referenceType: string;

  /** ID of the source record (CryptoTransaction, KinguinCode, etc.). */
  readonly referenceId: string;

  /** Extra provider-specific context (optional). */
  readonly metadata: Record<string, unknown> | null;

  readonly createdAt: string; // ISO-8601
}

/**
 * Paginated wrapper returned by GET /user/transactions.
 */
export interface TransactionHistoryOutputDto {
  readonly items:      TransactionHistoryItemOutputDto[];
  readonly total:      number;
  readonly page:       number;
  readonly limit:      number;
  readonly totalPages: number;
}
