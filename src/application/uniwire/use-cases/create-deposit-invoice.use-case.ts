import { Injectable, Inject, Logger } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { UNIWIRE_API_PORT, UNIWIRE_REPOSITORY } from '../tokens/uniwire.tokens';
import type { IUniwireApiPort } from '../../../domain/uniwire/ports/uniwire-api.ports';
import type { IUniwireRepository } from '../../../domain/uniwire/ports/uniwire.repository.port';
import type { CreateDepositInvoiceCommand } from '../dto/create-deposit-invoice.command';
import {
  UniwireApiError,
  UniwireProfileNotFoundError,
} from '../../../domain/uniwire/errors/uniwire.errors';

export interface CreateDepositInvoiceResult {
  readonly invoiceId: string;
  readonly status: string;
  readonly address?: string;
}

export type CreateDepositInvoiceUseCaseResult =
  | { ok: true; value: CreateDepositInvoiceResult }
  | { ok: false; error: UniwireApiError | UniwireProfileNotFoundError };

@Injectable()
export class CreateDepositInvoiceUseCase {
  private readonly logger = new Logger(CreateDepositInvoiceUseCase.name);

  constructor(
    @Inject(UNIWIRE_API_PORT)
    private readonly api: IUniwireApiPort,
    @Inject(UNIWIRE_REPOSITORY)
    private readonly repo: IUniwireRepository,
  ) {}

  async execute(cmd: CreateDepositInvoiceCommand): Promise<CreateDepositInvoiceUseCaseResult> {
    const profile = await this.repo.findProfileByUsername(cmd.username);
    if (!profile) {
      return Err(new UniwireProfileNotFoundError(cmd.username));
    }

    try {
      const result = await this.api.createInvoice({
        profileId: profile.profileId,
        currency: cmd.currency,
        kind: cmd.kind,
        passthrough: cmd.passthrough,
      });

      await this.repo.createInvoice({
        username: cmd.username,
        invoiceId: result.invoiceId,
        profileId: profile.profileId,
        currency: cmd.currency,
        kind: cmd.kind,
        address: result.address ?? null,
        status: result.status,
      });

      this.logger.log(
        `Deposit invoice created — user=${cmd.username} invoiceId=${result.invoiceId}`,
      );

      return Ok({
        invoiceId: result.invoiceId,
        status: result.status,
        address: result.address,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Err(new UniwireApiError(message));
    }
  }
}
