import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Sort order ────────────────────────────────────────────────────────────────

export enum TransactionSortOrder {
  DESC = 'desc',
  ASC = 'asc',
}

// ── Enum mirrors (kept here so the presentation layer has no Prisma imports) ──

export enum TransactionCategoryFilter {
  CRYPTO = 'CRYPTO',
  KINGUIN_REDEEM = 'KINGUIN_REDEEM',
  PET = 'PET',
  REFUND = 'REFUND',
}

export enum TransactionDirectionFilter {
  IN = 'IN',
  OUT = 'OUT',
}

export enum TransactionStatusFilter {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

export enum TransactionAssetTypeFilter {
  CRYPTO = 'CRYPTO',
  GIFT_CARD = 'GIFT_CARD',
  ITEM = 'ITEM',
}

// ── Query DTO ─────────────────────────────────────────────────────────────────

/**
 * Accepted query parameters for GET /user/transactions
 *
 * All fields are optional — omitting them returns the full paginated history
 * sorted newest-first.
 */
export class TransactionHistoryQueryDto {
  /**
   * Number of records per page (1–100, default 10).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  /**
   * 1-based page number (default 1).
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  /**
   * Sort direction applied to `createdAt`.
   * - `desc` (default) — newest transactions first
   * - `asc`            — oldest transactions first
   */
  @IsOptional()
  @IsEnum(TransactionSortOrder)
  order?: TransactionSortOrder = TransactionSortOrder.DESC;

  /**
   * Filter by transaction category.
   * - `CRYPTO`         — crypto deposit/withdrawal
   * - `KINGUIN_REDEEM` — gift card redemption
   * - `PET`            — in-game pet deposit
   * - `REFUND`         — platform refund
   */
  @IsOptional()
  @IsEnum(TransactionCategoryFilter)
  category?: TransactionCategoryFilter;

  /**
   * Filter by flow direction.
   * - `IN`  — funds credited to the user (deposits, refunds)
   * - `OUT` — funds debited from the user (withdrawals, tips sent)
   */
  @IsOptional()
  @IsEnum(TransactionDirectionFilter)
  direction?: TransactionDirectionFilter;

  /**
   * Filter by settlement status.
   */
  @IsOptional()
  @IsEnum(TransactionStatusFilter)
  status?: TransactionStatusFilter;

  /**
   * Filter by asset type.
   * - `CRYPTO`    — cryptocurrency
   * - `GIFT_CARD` — Kinguin code
   * - `ITEM`      — in-game inventory item
   */
  @IsOptional()
  @IsEnum(TransactionAssetTypeFilter)
  assetType?: TransactionAssetTypeFilter;

  /**
   * Inclusive lower bound for `createdAt` (ISO-8601, e.g. 2025-01-01T00:00:00Z).
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  /**
   * Inclusive upper bound for `createdAt` (ISO-8601, e.g. 2025-12-31T23:59:59Z).
   */
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;
}
