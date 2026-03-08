/**
 * Internal command issued by infrastructure services (crypto webhook handler,
 * Kinguin redemption service, etc.) to record a new transaction entry.
 *
 * This is intentionally NOT exposed as a public HTTP endpoint — transactions
 * are created as a side-effect of other operations (deposit confirmed,
 * code redeemed, item deposited), never directly by the user.
 */
export interface CreateTransactionCommand {
  /** The username the transaction belongs to. */
  readonly userUsername: string;

  /** CRYPTO | KINGUIN_REDEEM | PET | REFUND */
  readonly category: string;

  /** IN (credit) or OUT (debit) */
  readonly direction: string;

  /** KINGUIN | UNIWIRE | INGAME */
  readonly provider: string;

  /** PENDING | COMPLETED | FAILED | CANCELED */
  readonly status: string;

  /**
   * Raw USD equivalent (use 0 when not applicable, e.g. item deposits).
   * Stored as a high-precision Decimal(36,18) in the database.
   */
  readonly usdAmountPaid: number;

  /**
   * Raw crypto/token amount.
   * Stored as Decimal(36,18). Use 0 for non-crypto transactions.
   */
  readonly cryptoAmountPaid: number;

  /** In-game coin amount (the value credited/debited from the user balance). */
  readonly coinAmountPaid: number;

  /** User's balance immediately after this transaction is applied. */
  readonly balanceAfter: number;

  /** CRYPTO | GIFT_CARD | ITEM */
  readonly assetType: string;

  /** Asset ticker, e.g. "BTC", "ETH". Omit for gift cards and items. */
  readonly assetSymbol?: string;

  /** CRYPTO_TRANSACTION | KINGUIN_CODE | INVENTORY_ITEM | GAME_HISTORY | TIP_TRANSACTION */
  readonly referenceType: string;

  /** ID of the source record that triggered this transaction. */
  readonly referenceId: string;

  /**
   * Optional unstructured metadata (provider callbacks, trade IDs, etc.).
   * Keep shallow — avoid nesting large blobs here.
   */
  readonly metadata?: Record<string, unknown>;
}
