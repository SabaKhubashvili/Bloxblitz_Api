import { Injectable, Inject } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { UNIWIRE_API_PORT, UNIWIRE_REPOSITORY } from '../tokens/uniwire.tokens';
import type { IUniwireApiPort } from '../../../domain/uniwire/ports/uniwire-api.ports';
import type { IUniwireRepository } from '../../../domain/uniwire/ports/uniwire.repository.port';
import type { GetDepositAddressQuery } from '../dto/get-deposit-address.query';
import type { UniwireGetCoinAddressResponse } from '../../../domain/uniwire/entities/uniwire.entity';
import {
  UniwireApiError,
  UniwireAddressNotFoundError,
  UniwireProfileNotFoundError,
} from '../../../domain/uniwire/errors/uniwire.errors';

export type GetDepositAddressResult =
  | { ok: true; value: UniwireGetCoinAddressResponse }
  | { ok: false; error: UniwireApiError | UniwireProfileNotFoundError | UniwireAddressNotFoundError };

@Injectable()
export class GetDepositAddressUseCase {
  constructor(
    @Inject(UNIWIRE_API_PORT)
    private readonly api: IUniwireApiPort,
    @Inject(UNIWIRE_REPOSITORY)
    private readonly repo: IUniwireRepository,
  ) {}

  async execute(query: GetDepositAddressQuery): Promise<GetDepositAddressResult> {
    const profile = await this.repo.findProfileByUsername(query.username);
    if (!profile) {
      return Err(new UniwireProfileNotFoundError(query.username));
    }

    try {
      const result = await this.api.getCoinAddress(profile.profileId);
      if (!result?.address) {
        return Err(new UniwireAddressNotFoundError());
      }
      return Ok(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Err(new UniwireApiError(message));
    }
  }
}
