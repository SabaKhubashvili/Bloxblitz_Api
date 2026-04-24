import { Injectable, Inject } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { UNIWIRE_API_PORT } from '../tokens/uniwire.tokens';
import type { IUniwireApiPort } from '../../../domain/uniwire/ports/uniwire-api.ports';
import type { UniwireExchangeRate } from '../../../domain/uniwire/entities/uniwire.entity';
import {
  UniwireApiError,
  UniwireExchangeRateUnavailableError,
} from '../../../domain/uniwire/errors/uniwire.errors';

export type GetExchangeRatesResult =
  | { ok: true; value: readonly UniwireExchangeRate[] }
  | { ok: false; error: UniwireApiError | UniwireExchangeRateUnavailableError };

@Injectable()
export class GetExchangeRatesUseCase {
  constructor(
    @Inject(UNIWIRE_API_PORT)
    private readonly api: IUniwireApiPort,
  ) {}

  async execute(): Promise<GetExchangeRatesResult> {
    try {
      const rates = await this.api.getExchangeRates();
      if (!rates?.result?.length) {
        return Err(new UniwireExchangeRateUnavailableError());
      }
      return Ok(rates.result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Err(new UniwireApiError(message));
    }
  }
}
