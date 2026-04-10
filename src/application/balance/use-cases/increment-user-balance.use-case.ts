import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IUserBalanceRepository } from '../ports/user-balance.repository.port';
import { USER_BALANCE_REPOSITORY } from '../tokens/balance.tokens';

/**
 * Global use-case for crediting coins to a user's balance.
 *
 * Delegates to {@link IUserBalanceRepository.increment}.
 */
@Injectable()
export class IncrementUserBalanceUseCase {
  private readonly logger = new Logger(IncrementUserBalanceUseCase.name);

  constructor(
    @Inject(USER_BALANCE_REPOSITORY)
    private readonly balance: IUserBalanceRepository,
  ) {}

  async execute(username: string, amount: number): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) {
      this.logger.warn(
        `[IncrementBalance] Skipped: non-positive or invalid amount=${amount} user=${username}`,
      );
      return;
    }

    const rounded = Math.round(amount * 100) / 100;

    this.logger.log(
      `[IncrementBalance] Crediting user=${username} amount=+${rounded}`,
    );

    await this.balance.increment(username, rounded);

    this.logger.log(
      `[IncrementBalance] Credited user=${username} amount=+${rounded}`,
    );
  }
}
