import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { ITransactionHistoryRepository } from '../../../../domain/user/ports/transaction-history.repository.port';
import type { TransactionHistoryItemOutputDto } from '../dto/transaction-history.output-dto';
import {
  TransactionNotFoundError,
  TransactionFetchError,
  type TransactionError,
} from '../../../../domain/user/errors/transaction.errors';
import { TRANSACTION_HISTORY_REPOSITORY } from '../tokens/transaction.tokens';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface GetTransactionByIdInput {
  /** Transaction UUID to look up. */
  readonly id: string;

  /**
   * Authenticated user's username (from JWT).
   * The repository enforces that the transaction belongs to this user —
   * ownership is checked at the data layer, not just the HTTP layer.
   */
  readonly username: string;
}

// ─── Use-case ─────────────────────────────────────────────────────────────────

/**
 * Fetches a single transaction by ID for the authenticated user.
 *
 * Input:  GetTransactionByIdInput
 * Output: Result<TransactionHistoryItemOutputDto, TransactionError>
 *
 * Possible errors:
 *  - TransactionNotFoundError — no transaction exists for (id, username) pair
 *  - TransactionFetchError    — unexpected infrastructure failure
 */
@Injectable()
export class GetTransactionByIdUseCase implements IUseCase<
  GetTransactionByIdInput,
  Result<TransactionHistoryItemOutputDto, TransactionError>
> {
  private readonly logger = new Logger(GetTransactionByIdUseCase.name);

  constructor(
    @Inject(TRANSACTION_HISTORY_REPOSITORY)
    private readonly repo: ITransactionHistoryRepository,
  ) {}

  async execute(
    input: GetTransactionByIdInput,
  ): Promise<Result<TransactionHistoryItemOutputDto, TransactionError>> {
    const { id, username } = input;

    try {
      const record = await this.repo.findByIdAndUsername(id, username);

      // Returns null both when not found AND when the record belongs to
      // a different user — avoids leaking the existence of other users' data.
      if (!record) {
        return Err(new TransactionNotFoundError(id));
      }

      const dto: TransactionHistoryItemOutputDto = {
        id: record.id,
        category: record.category,
        direction: record.direction,
        provider: record.provider,
        status: record.status,
        coinAmountPaid: record.coinAmountPaid,
        usdAmountPaid: record.usdAmountPaid,
        balanceAfter: record.balanceAfter,
        assetType: record.assetType,
        assetSymbol: record.assetSymbol,
        referenceType: record.referenceType,
        referenceId: record.referenceId,
        metadata: record.metadata,
        createdAt: record.createdAt.toISOString(),
      };

      return Ok(dto);
    } catch (err) {
      this.logger.error(
        `[Transactions] Fetch by ID failed — id="${id}", user="${username}"`,
        err,
      );
      return Err(new TransactionFetchError());
    }
  }
}
