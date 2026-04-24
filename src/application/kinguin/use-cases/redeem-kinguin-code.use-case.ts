import { Injectable, Inject, Logger } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import {
  KinguinCodeNotFoundError,
  KinguinCodeAlreadyRedeemedError,
  KinguinCodeDisabledError,
  KinguinCodeExpiredError,
  KinguinCodeRedemptionInProgressError,
} from '../../../domain/kinguin/errors/kinguin.errors';
import {
  KINGUIN_CODE_REPOSITORY,
  KINGUIN_BALANCE_PORT,
  KINGUIN_CACHE_PORT,
} from '../tokens/kinguin.tokens';
import type { IKinguinCodeRepository } from '../../../domain/kinguin/ports/kinguin-code.repository.port';
import type { IKinguinBalancePort } from '../ports/kinguin-balance.port';
import type { IKinguinCachePort } from '../ports/kinguin-cache.port';
import { CreateTransactionUseCase } from '../../user/transactions/use-cases/create-transaction.use-case';
import { hashCode } from '../../../shared/utils/kinguin-hash.util';

const CODE_LOCK_TTL_MS = 10_000;

export interface RedeemKinguinCodeCommand {
  username: string;
  code: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface RedeemKinguinCodeResult {
  codeId: string;
  creditAmount: number;
  newBalance: number;
}

/**
 * Redeems a Kinguin promo code for the authenticated user.
 *
 * Codes are stored as SHA-256 hashes in the database. We hash the user-provided
 * code and compare with the stored hash — never decode or reverse the hash.
 */
@Injectable()
export class RedeemKinguinCodeUseCase {
  private readonly logger = new Logger(RedeemKinguinCodeUseCase.name);

  constructor(
    @Inject(KINGUIN_CODE_REPOSITORY)
    private readonly codeRepo: IKinguinCodeRepository,
    @Inject(KINGUIN_BALANCE_PORT)
    private readonly balance: IKinguinBalancePort,
    @Inject(KINGUIN_CACHE_PORT)
    private readonly cache: IKinguinCachePort,
    private readonly createTransaction: CreateTransactionUseCase,
  ) {}

  async execute(cmd: RedeemKinguinCodeCommand): Promise<
    | { ok: true; value: RedeemKinguinCodeResult }
    | {
        ok: false;
        error:
          | KinguinCodeNotFoundError
          | KinguinCodeAlreadyRedeemedError
          | KinguinCodeDisabledError
          | KinguinCodeExpiredError
          | KinguinCodeRedemptionInProgressError;
      }
  > {
    const codeHash = hashCode(cmd.code.trim());

    const acquired = await this.cache.acquireCodeLock(
      codeHash,
      CODE_LOCK_TTL_MS,
    );
    if (!acquired) {
      return Err(new KinguinCodeRedemptionInProgressError());
    }

    try {
      const record = await this.codeRepo.findByCode(codeHash);
      if (!record) {
        return Err(new KinguinCodeNotFoundError());
      }
      if (record.isRedeemed || record.status === 'REDEEMED') {
        return Err(new KinguinCodeAlreadyRedeemedError());
      }
      if (record.status === 'DISABLED') {
        return Err(new KinguinCodeDisabledError());
      }
      if (
        record.status === 'EXPIRED' ||
        (record.expiresAt && record.expiresAt < new Date())
      ) {
        return Err(new KinguinCodeExpiredError());
      }

      const creditsBefore = await this.balance.getBalance(cmd.username);
      const creditsAfter =
        Math.round((creditsBefore + record.value) * 100) / 100;

      await this.codeRepo.redeemCode(record.id, record.batchId, {
        username: cmd.username,
        ipAddress: cmd.ipAddress,
        userAgent: cmd.userAgent,
        creditsBefore,
        creditsAfter,
        creditAmount: record.value,
      });

      await this.balance.creditBalance(cmd.username, record.value);

      this.logger.log(
        `Code redeemed — user=${cmd.username} codeId=${record.id} amount=${record.value}`,
      );

      void this.createTransaction
        .execute({
          userUsername: cmd.username,
          category: 'KINGUIN_REDEEM',
          direction: 'IN',
          provider: 'KINGUIN',
          status: 'COMPLETED',
          usdAmountPaid: 0,
          cryptoAmountPaid: 0,
          coinAmountPaid: record.value,
          balanceAfter: creditsAfter,
          assetType: 'GIFT_CARD',
          referenceType: 'KINGUIN_CODE',
          referenceId: record.id,
        })
        .catch((err) =>
          this.logger.warn(
            `TransactionHistory write failed — user=${cmd.username} codeId=${record.id}`,
            err,
          ),
        );

      return Ok({
        codeId: record.id,
        creditAmount: record.value,
        newBalance: creditsAfter,
        message: 'Code redeemed successfully',
      });
    } finally {
      await this.cache.releaseCodeLock(codeHash);
    }
  }
}
