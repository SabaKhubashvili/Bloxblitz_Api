/**
 * The data returned to the presentation layer after a successful balance fetch.
 * All monetary values have been validated and rounded to 2 decimal places
 * via the Money value object before reaching this DTO.
 */
export interface GetBalanceOutputDto {
  /** Game coin balance — the primary spendable currency. */
  readonly balance: number;
  /** Aggregate value of all available inventory (pet) items. */
  readonly petValueBalance: number;
  /** Always "COIN" — reserved for future multi-currency support. */
  readonly currency: string;
}
