import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type {
  ITransactionHistoryRepository,
  TransactionRecord,
  TransactionHistoryFilters,
} from '../../../../domain/user/ports/transaction-history.repository.port';
import type { GetTransactionHistoryQuery } from '../dto/get-transaction-history.query';
import type {
  TransactionHistoryOutputDto,
  TransactionHistoryItemOutputDto,
} from '../dto/transaction-history.output-dto';
import {
  TransactionFetchError,
  InvalidDateRangeError,
  type TransactionError,
} from '../../../../domain/user/errors/transaction.errors';
import { TRANSACTION_HISTORY_REPOSITORY } from '../tokens/transaction.tokens';

// ─── Business-rule constants ──────────────────────────────────────────────────

/**
 * Hard server-side cap on items per page.
 * Prevents a malicious or misconfigured client from requesting thousands of
 * rows even if the HTTP DTO allows up to 100.
 */
const MAX_PAGE_LIMIT = 100;

/** Enums mirrored from Prisma — kept here so the use-case is self-contained. */
const VALID_CATEGORIES  = new Set(['CRYPTO', 'KINGUIN_REDEEM', 'PET', 'REFUND']);
const VALID_DIRECTIONS  = new Set(['IN', 'OUT']);
const VALID_STATUSES    = new Set(['PENDING', 'COMPLETED', 'FAILED', 'CANCELED']);
const VALID_ASSET_TYPES = new Set(['CRYPTO', 'GIFT_CARD', 'ITEM']);

// ─── Use-case ─────────────────────────────────────────────────────────────────

/**
 * Returns a paginated, optionally filtered list of the authenticated user's
 * transaction history.
 *
 * Business rules enforced here (not delegated to the HTTP layer):
 *  1. `limit` is capped at MAX_PAGE_LIMIT regardless of what the caller passes.
 *  2. Unknown enum values for category / direction / status / assetType are
 *     silently dropped so the query still succeeds (tolerant reads).
 *  3. `from` > `to` is rejected immediately — InvalidDateRangeError.
 *  4. `to` is normalised to end-of-day (23:59:59.999) when no time component
 *     is present, so ?to=2025-03-01 captures the full calendar day.
 *
 * Input:  GetTransactionHistoryQuery
 * Output: Result<TransactionHistoryOutputDto, TransactionError>
 *
 * Possible errors:
 *  - InvalidDateRangeError — `from` is chronologically after `to`
 *  - TransactionFetchError — unexpected infrastructure failure
 */
@Injectable()
export class GetUserTransactionHistoryUseCase
  implements IUseCase<GetTransactionHistoryQuery, Result<TransactionHistoryOutputDto, TransactionError>>
{
  private readonly logger = new Logger(GetUserTransactionHistoryUseCase.name);

  constructor(
    @Inject(TRANSACTION_HISTORY_REPOSITORY)
    private readonly repo: ITransactionHistoryRepository,
  ) {}

  async execute(
    query: GetTransactionHistoryQuery,
  ): Promise<Result<TransactionHistoryOutputDto, TransactionError>> {
    const {
      username,
      order,
      category,
      direction,
      status,
      assetType,
      from,
      to,
    } = query;

    // ── Rule 1: Enforce server-side pagination cap ────────────────────────────
    const page  = Math.max(1, query.page);
    const limit = Math.min(Math.max(1, query.limit), MAX_PAGE_LIMIT);

    // ── Rule 2: Parse + validate date bounds ─────────────────────────────────
    const fromDate = this.parseFrom(from);
    const toDate   = this.parseTo(to);

    if (fromDate && toDate && fromDate > toDate) {
      return Err(new InvalidDateRangeError());
    }

    // ── Rule 3: Drop unknown enum values (tolerant filter reads) ─────────────
    const filters: TransactionHistoryFilters = {
      category:  category  && VALID_CATEGORIES.has(category)   ? category  : undefined,
      direction: direction && VALID_DIRECTIONS.has(direction)  ? direction : undefined,
      status:    status    && VALID_STATUSES.has(status)       ? status    : undefined,
      assetType: assetType && VALID_ASSET_TYPES.has(assetType) ? assetType : undefined,
      from:      fromDate,
      to:        toDate,
    };

    try {
      const pageData = await this.repo.findPageByUsername(
        username,
        page,
        limit,
        order,
        filters,
      )

      return Ok({
        items:      pageData.items.map(toItemDto),
        total:      pageData.total,
        page,
        limit,
        totalPages: pageData.total === 0 ? 0 : Math.ceil(pageData.total / limit),
      });
    } catch (err) {
      this.logger.error(
        `[Transactions] History fetch failed — user="${username}" page=${page} limit=${limit}`,
        err,
      );
      return Err(new TransactionFetchError());
    }
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Parses an ISO-8601 string to a Date; returns undefined on missing/invalid input. */
  private parseFrom(raw?: string): Date | undefined {
    if (!raw) return undefined;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? undefined : d;
  }

  /**
   * Parses an ISO-8601 string to a Date.
   * When only a date (YYYY-MM-DD) is provided — no time component — normalises
   * to 23:59:59.999 so the entire calendar day is included in the range.
   */
  private parseTo(raw?: string): Date | undefined {
    if (!raw) return undefined;
    const d = new Date(raw);
    if (isNaN(d.getTime())) return undefined;

    // If the original string looks like a plain date (no 'T' separator)
    // push the cutoff to the very end of that day.
    if (!raw.includes('T')) {
      d.setHours(23, 59, 59, 999);
    }

    return d;
  }
}

// ─── Mapper (private to this module) ─────────────────────────────────────────

function toItemDto(r: TransactionRecord): TransactionHistoryItemOutputDto {
  return {
    id:             r.id,
    category:       r.category,
    direction:      r.direction,
    provider:       r.provider,
    status:         r.status,
    // Round to 2 dp for display — high-precision Decimal is stored in DB
    coinAmountPaid: Math.round(r.coinAmountPaid * 100) / 100,
    usdAmountPaid:  r.usdAmountPaid,
    balanceAfter:   Math.round(r.balanceAfter * 100) / 100,
    assetType:      r.assetType,
    assetSymbol:    r.assetSymbol,
    referenceType:  r.referenceType,
    referenceId:    r.referenceId,
    metadata:       r.metadata,
    createdAt:      r.createdAt.toISOString(),
  };
}
