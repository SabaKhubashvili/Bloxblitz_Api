import { Inject, Injectable } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { UniwireApiError } from '../../../domain/uniwire/errors/uniwire.errors';
import { type IUniwireRepository } from 'src/domain/uniwire/ports/uniwire.repository.port';
import { UNIWIRE_REPOSITORY } from '../tokens/uniwire.tokens';
import { UniwireCallbackDto } from 'src/presentation/http/public/uniwire/dto/handle-uniwire-callback.dto';
import { UniwireCallbackStatus } from 'src/domain/uniwire/entities/uniwire.entity';
import { AvailableCryptos, TransactionStatus } from '@prisma/client';
import { KINGUIN_BALANCE_PORT } from 'src/application/kinguin/tokens/kinguin.tokens';
import type { IKinguinBalancePort } from 'src/application/kinguin/ports/kinguin-balance.port';

export type HandleTransactionConfirmedResult =
  | { ok: true; value: void }
  | { ok: false; error: UniwireApiError };

@Injectable()
export class HandleTransactionConfirmedUseCase {
  constructor(
    @Inject(UNIWIRE_REPOSITORY)
    private readonly repo: IUniwireRepository,
    @Inject(KINGUIN_BALANCE_PORT)
    private readonly balance: IKinguinBalancePort,
  ) {}

  async execute(
    query: UniwireCallbackDto,
  ): Promise<HandleTransactionConfirmedResult> {
    try {
      if (
        query.callback_status !== UniwireCallbackStatus.TRANSACTION_CONFIRMED
      ) {
        return Err(new UniwireApiError('Transaction is not confirmed'));
      }

      const username = this.extractUsername(
        query.transaction?.invoice.passthrough ?? '',
      );
      const cryptoAmount =
        (query.transaction?.amount.paid?.amount as number) ?? 0;
      const coinAmountPaid = this.getCoinAmountPaid(cryptoAmount);
      let balanceAfter = 0;
     

      if (username !== 'unknown' && coinAmountPaid > 0) {
        balanceAfter = await this.balance.creditBalance(username, coinAmountPaid);
      }
      await this.repo.updateInvoiceTransactionConfirmed({
        invoiceId: query.transaction?.invoice?.id ?? '',
        providerTransactionId: query.transaction?.id ?? '',
        status: TransactionStatus.COMPLETED,
        txid: query.transaction?.txid ?? '',
        currency:
          (query.transaction?.amount.paid?.currency as AvailableCryptos) ??
          AvailableCryptos.BTC,
        network: query.invoice?.network ?? '',
        usdAmountPaid: this.getUsdAmountPaid(
          query.transaction?.amount.paid?.quotes ?? {},
          (query.invoice?.amount.paid?.currency as AvailableCryptos) ??
            AvailableCryptos.BTC,
        ),
        cryptoAmountPaid: this.getCryptoAmountPaid(cryptoAmount),
        coinAmountPaid,
        username,
        minConfirmations: query.transaction?.invoice.min_confirmations ?? 0,
        confirmations: query.transaction?.confirmations ?? 0,
        balanceAfter: balanceAfter  ,
      });

      return Ok(void 0);
    } catch (err) {
      return Err(
        new UniwireApiError(
          err instanceof Error ? err.message : 'Unknown error',
        ),
      );
    }
  }
  private getUsdAmountPaid(
    quotes: Record<string, number>,
    currency: AvailableCryptos,
  ): number {
    return quotes[currency] ?? 0;
  }
  private getCryptoAmountPaid(amount: number): number {
    return amount ?? 0;
  }
  private getCoinAmountPaid(amount: number): number {
    return amount ? amount * 2.02 : 0;
  }

  private extractUsername(passthrough: any): string {
    if (!passthrough) {
      return 'unknown';
    }

    let parsedPassthrough: any = null;

    if (typeof passthrough === 'string') {
      try {
        parsedPassthrough = JSON.parse(passthrough);
      } catch {
        try {
          parsedPassthrough = JSON.parse(passthrough.replace(/'/g, '"'));
        } catch (e) {
          return 'unknown';
        }
      }
    } else {
      parsedPassthrough = passthrough;
    }

    return parsedPassthrough?.username || 'unknown';
  }
}
