import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IIncrementUserBalancePort } from '../ports/increment-user-balance.port';
import { INCREMENT_USER_BALANCE_PORT } from '../tokens/balance.tokens';

/**
 * Global use-case for crediting coins to a user's balance.
 *
 * This is the single, canonical entry-point for all balance increments
 * across the system. It centralises validation, sanitisation, and logging
 * so every caller benefits automatically.
 *
 * Usage:
 *   await this.incrementBalance.execute(username, wonAmount);
 *
 * Exceptions:
 *   Use-cases that require specialised balance semantics (e.g. atomic
 *   bet-settle with nonce tracking in the Dice game) may bypass this
 *   and interact directly with their own ledger port.
 */
@Injectable()
export class IncrementUserBalanceUseCase {
  private readonly logger = new Logger(IncrementUserBalanceUseCase.name);

  constructor(
    @Inject(INCREMENT_USER_BALANCE_PORT)
    private readonly balancePort: IIncrementUserBalancePort,
  ) {}

  /**
   * Credits `amount` coins to the user.
   *
   * No-ops silently for zero / negative / non-finite amounts so callers
   * never need to guard the value themselves.
   */
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

    await this.balancePort.increment(username, rounded);

    this.logger.log(
      `[IncrementBalance] Credited user=${username} amount=+${rounded}`,
    );
  }
}
