import { Injectable, Inject, Logger } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { UNIWIRE_API_PORT, UNIWIRE_REPOSITORY } from '../tokens/uniwire.tokens';
import type { IUniwireApiPort } from '../../../domain/uniwire/ports/uniwire-api.ports';
import type { IUniwireRepository } from '../../../domain/uniwire/ports/uniwire.repository.port';
import type { CreatePayoutCommand } from '../dto/create-payout.command';
import {
  UniwireApiError,
  UniwirePayoutFailedError,
  UniwireProfileNotFoundError,
} from '../../../domain/uniwire/errors/uniwire.errors';

export interface CreatePayoutResult {
  readonly payoutId: string;
  readonly status: string;
}

export type CreatePayoutUseCaseResult =
  | { ok: true; value: CreatePayoutResult }
  | { ok: false; error: UniwireApiError | UniwireProfileNotFoundError | UniwirePayoutFailedError };

@Injectable()
export class CreatePayoutUseCase {
  private readonly logger = new Logger(CreatePayoutUseCase.name);

  constructor(
    @Inject(UNIWIRE_API_PORT)
    private readonly api: IUniwireApiPort,
    @Inject(UNIWIRE_REPOSITORY)
    private readonly repo: IUniwireRepository,
  ) {}

  async execute(cmd: CreatePayoutCommand): Promise<CreatePayoutUseCaseResult> {
    if (cmd.amount <= 0) {
      return Err(new UniwirePayoutFailedError('Amount must be positive'));
    }

    const profile = await this.repo.findInvoiceByUsernameAndCurrency(cmd.username, cmd.currency);
    if (!profile) { 
      return Err(new UniwireProfileNotFoundError(cmd.username));
    }

    try {
      const result = await this.api.createPayout({
        profileId: profile.address,
        amount: cmd.amount,
        currency: cmd.currency,
        kind: cmd.kind,
      });

      await this.repo.createPayout({
        username: cmd.username,
        payoutId: result.payoutId,
        amount: cmd.amount,
        currency: cmd.currency,
        status: result.status,
      });

      this.logger.log(
        `Payout created — user=${cmd.username} payoutId=${result.payoutId} amount=${cmd.amount}`,
      );

      return Ok({
        payoutId: result.payoutId,
        status: result.status,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Err(new UniwireApiError(message));
    }
  }
}
