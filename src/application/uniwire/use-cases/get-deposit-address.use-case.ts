import { Injectable, Inject } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { UNIWIRE_API_PORT, UNIWIRE_REPOSITORY } from '../tokens/uniwire.tokens';
import type { IUniwireApiPort, UniwireInvoiceKind } from '../../../domain/uniwire/ports/uniwire-api.ports';
import type { IUniwireRepository } from '../../../domain/uniwire/ports/uniwire.repository.port';
import type { GetDepositAddressQuery } from '../dto/get-deposit-address.query';
import type {
  UniwireInvoiceResult,
} from '../../../domain/uniwire/entities/uniwire.entity';
import {
  UniwireApiError,
  UniwireAddressNotFoundError,
  UniwireProfileNotFoundError,
} from '../../../domain/uniwire/errors/uniwire.errors';
import { AvailableCryptos } from '@prisma/client';
import { getUniwireInvoiceKind } from 'src/domain/uniwire/services/uniwire-helpers.service';

export type GetDepositAddressResult =
  | { ok: true; value: UniwireInvoiceResult }
  | {
      ok: false;
      error:
        | UniwireApiError
        | UniwireProfileNotFoundError
        | UniwireAddressNotFoundError;
    };

@Injectable()
export class GetDepositAddressUseCase {
  constructor(
    @Inject(UNIWIRE_API_PORT)
    private readonly api: IUniwireApiPort,
    @Inject(UNIWIRE_REPOSITORY)
    private readonly repo: IUniwireRepository,
  ) {}

  async execute(
    query: GetDepositAddressQuery,
  ): Promise<GetDepositAddressResult> {
    const invoice = await this.repo.findInvoiceByUsernameAndCurrency(
      query.username,
      query.currency,
    );
    if (invoice) {
      const recentTransactions = await this.repo.getRecentTransactions(query.username, this.currencyToCrypto(query.currency), 4);
      return {
        ok: true,
        value: {
          currency: this.currencyToCrypto(query.currency),
          address: invoice.address,
          recentTransactions
        },
      };
    }

    try {
      const result = await this.api.createDepositAddress(
        this.currencyToCrypto(query.currency),
        { currency: query.currency, username: query.username },
      );
      
      if (!result?.address || !result?.invoiceId) {
        return Err(new UniwireAddressNotFoundError());
      }
      await this.repo.createInvoice({
        userUsername: query.username,
        invoiceId: result.invoiceId,
        profileId: result.profileId ?? '',
        currency: this.currencyToCrypto(query.currency),
        kind: getUniwireInvoiceKind(query.currency) as UniwireInvoiceKind,
        address: result.address,
        lastUsedAt: new Date()
      });

      return Ok({
        currency: this.currencyToCrypto(query.currency),
        address: result.address,
        network: result.network,
        recentTransactions: []
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return Err(new UniwireApiError(message));
    }
  }
  private currencyToCrypto(currency: string): AvailableCryptos {
    switch (currency) {
      case 'BTC':
        return AvailableCryptos.BTC;
      case 'ETH':
        return AvailableCryptos.ETH;
      case 'LTC':
        return AvailableCryptos.LTC;
      case 'USDT':
        return AvailableCryptos.USDT;
      case 'DOGE':
        return AvailableCryptos.DOGE;
      default:
        throw new Error(`Invalid currency: ${currency}`);
    }
  }
}
