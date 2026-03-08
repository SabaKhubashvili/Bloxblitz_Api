import { Injectable, Inject } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { UNIWIRE_API_PORT } from '../tokens/uniwire.tokens';
import type { IUniwireApiPort } from '../../../domain/uniwire/ports/uniwire-api.ports';
import type { UniwireRecentTransaction } from '../../../domain/uniwire/entities/uniwire.entity';
import { UniwireApiError } from '../../../domain/uniwire/errors/uniwire.errors';

export interface GetTransactionConfirmationsCommand {
  readonly transactionIds: string[];
}

export type GetTransactionConfirmationsResult =
  | { ok: true; value: UniwireRecentTransaction[] }
  | { ok: false; error: UniwireApiError };

@Injectable()
export class GetTransactionConfirmationsUseCase {
  constructor(
    @Inject(UNIWIRE_API_PORT)
    private readonly api: IUniwireApiPort,
  ) {}

  async execute(cmd: GetTransactionConfirmationsCommand): Promise<GetTransactionConfirmationsResult> {
    if (!cmd.transactionIds?.length) {
      return Ok([]);
    }
    try {
      const confirmations = await this.api.getTransactionConfirmations(cmd.transactionIds);
      return Ok(confirmations ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Err(new UniwireApiError(message));
    }
  }
}
