import { Injectable, Inject, Logger } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { UNIWIRE_API_PORT, UNIWIRE_REPOSITORY } from '../tokens/uniwire.tokens';
import type { IUniwireApiPort, UniwireInvoiceKind } from '../../../domain/uniwire/ports/uniwire-api.ports';
import type { IUniwireRepository } from '../../../domain/uniwire/ports/uniwire.repository.port';
import type { CreateDepositInvoiceCommand } from '../dto/create-deposit-invoice.command';
import {
  UniwireAddressNotFoundError,
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
  | { ok: false; error: UniwireApiError | UniwireAddressNotFoundError };

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
    const profile = await this.repo.findInvoiceByUsernameAndCurrency(cmd.username, cmd.currency);
    if (!profile) {
      return Err(new UniwireAddressNotFoundError());
    }
    

    try {
      const result = await this.api.createInvoice({
        profile_id: profile.address,
        currency: cmd.currency,
        kind: cmd.kind as UniwireInvoiceKind,
        passthrough: cmd.passthrough,
      });
      console.log(result);
      if(!result.result.address) {
        return Err(new UniwireAddressNotFoundError());
      }


      await this.repo.createInvoice({
        userUsername: cmd.username,
        profileId: profile.profileId,
        invoiceId: result.result.id,
        currency: cmd.currency,
        kind: cmd.kind,
        address: result.result.address,
        lastUsedAt: new Date(),
      });

      this.logger.log(
        `Deposit invoice created — user=${cmd.username} invoiceId=${result.result.id}`,
      );

      return Ok({
        invoiceId: result.result.id,
        status: result.result.status,
        address: result.result.address,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Err(new UniwireApiError(message));
    }
  }
}
