import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
  DecrementBalanceResult,
  IUserBalanceRepository,
} from '../ports/user-balance.repository.port';
import { USER_BALANCE_REPOSITORY } from '../tokens/balance.tokens';

/**
 * Global use-case for debiting a user's balance (bets, fees, etc.).
 *
 * Delegates to {@link IUserBalanceRepository.tryDecrement}.
 */
@Injectable()
export class DecrementUserBalanceUseCase {
  private readonly logger = new Logger(DecrementUserBalanceUseCase.name);

  constructor(
    @Inject(USER_BALANCE_REPOSITORY)
    private readonly balance: IUserBalanceRepository,
  ) {}

  async execute(
    username: string,
    amount: number,
  ): Promise<DecrementBalanceResult> {
    if (!Number.isFinite(amount) || amount <= 0) {
      this.logger.warn(
        `[DecrementBalance] Rejected non-positive amount=${amount} user=${username}`,
      );
      return { ok: false, reason: 'invalid_amount' };
    }

    const rounded = Math.round(amount * 100) / 100;

    this.logger.log(
      `[DecrementBalance] Debiting user=${username} amount=-${rounded}`,
    );

    const result = await this.balance.tryDecrement(username, rounded);

    if (result.ok) {
      this.logger.log(
        `[DecrementBalance] Debited user=${username} amount=-${rounded}`,
      );
    } else {
      this.logger.warn(
        `[DecrementBalance] Failed user=${username} amount=-${rounded} reason=${result.reason}`,
      );
    }

    return result;
  }
  async runDatabaseTransaction(
    username: string,
    amount: number,
  ): Promise<DecrementBalanceResult> {
    const rounded = Math.round(amount * 100) / 100;
  try {
    return await this.balance.runDatabaseTransaction(username, rounded);
  } catch (error) {
    this.logger.error(`[DecrementBalance] Failed user=${username} amount=-${amount}`, error);
    return { ok: false, reason: 'insufficient_funds' };
  }
  }
}
