import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { ITransactionHistoryRepository } from '../../../../domain/user/ports/transaction-history.repository.port';
import type { CreateTransactionCommand } from '../dto/create-transaction.command';
import type { TransactionHistoryItemOutputDto } from '../dto/transaction-history.output-dto';
import {
  TransactionCreateError,
  InvalidTransactionAmountError,
  type TransactionError,
} from '../../../../domain/user/errors/transaction.errors';
import { TRANSACTION_HISTORY_REPOSITORY } from '../tokens/transaction.tokens';

// ─── Use-case ─────────────────────────────────────────────────────────────────

/**
 * Records a new transaction entry in the unified ledger.
 *
 * ⚠️  INTERNAL USE ONLY — this use-case must never be wired to a public HTTP
 * endpoint. It is called as a side-effect by other internal services:
 *   - CryptoDepositService  (after a blockchain confirmation)
 *   - KinguinRedemptionService (after a gift-card code is validated)
 *   - InventoryDepositService  (after a pet trade is confirmed)
 *
 * Input:  CreateTransactionCommand
 * Output: Result<TransactionHistoryItemOutputDto, TransactionError>
 *
 * Possible errors:
 *  - InvalidTransactionAmountError — coinAmountPaid is zero or negative
 *  - TransactionCreateError        — unexpected infrastructure failure
 */
@Injectable()
export class CreateTransactionUseCase implements IUseCase<
  CreateTransactionCommand,
  Result<TransactionHistoryItemOutputDto, TransactionError>
> {
  private readonly logger = new Logger(CreateTransactionUseCase.name);

  constructor(
    @Inject(TRANSACTION_HISTORY_REPOSITORY)
    private readonly repo: ITransactionHistoryRepository,
  ) {}

  async execute(
    cmd: CreateTransactionCommand,
  ): Promise<Result<TransactionHistoryItemOutputDto, TransactionError>> {
    // ── Guard: amount must be positive ───────────────────────────────────────
    if (cmd.coinAmountPaid <= 0) {
      return Err(new InvalidTransactionAmountError(cmd.coinAmountPaid));
    }

    try {
      const record = await this.repo.create({
        userUsername: cmd.userUsername,
        category: cmd.category,
        direction: cmd.direction,
        provider: cmd.provider,
        status: cmd.status,
        usdAmountPaid: cmd.usdAmountPaid,
        cryptoAmountPaid: cmd.cryptoAmountPaid,
        coinAmountPaid: cmd.coinAmountPaid,
        balanceAfter: cmd.balanceAfter,
        assetType: cmd.assetType,
        assetSymbol: cmd.assetSymbol ?? null,
        referenceType: cmd.referenceType,
        referenceId: cmd.referenceId,
        metadata: cmd.metadata ?? null,
      });

      this.logger.log(
        `[Transactions] Created — id="${record.id}", user="${record.userUsername}", ` +
          `category="${record.category}", direction="${record.direction}", amount=${record.coinAmountPaid}`,
      );

      return Ok({
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
      });
    } catch (err) {
      this.logger.error(
        `[Transactions] Create failed for user="${cmd.userUsername}"`,
        err,
      );
      return Err(new TransactionCreateError());
    }
  }
}
