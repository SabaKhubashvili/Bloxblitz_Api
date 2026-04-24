import { Injectable, Inject, Logger } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { UNIWIRE_API_PORT, UNIWIRE_REPOSITORY } from '../tokens/uniwire.tokens';
import type { IUniwireApiPort } from '../../../domain/uniwire/ports/uniwire-api.ports';
import type { IUniwireRepository } from '../../../domain/uniwire/ports/uniwire.repository.port';
import { DecrementUserBalanceUseCase } from '../../balance/use-cases/decrement-user-balance.use-case';
import type { IBalanceRepository } from '../../../domain/user/ports/balance.repository.port';
import { BALANCE_REPOSITORY } from '../../user/tokens/user.tokens';
import type { CreatePayoutCommand } from '../dto/create-payout.command';
import {
  UniwireApiError,
  UniwirePayoutFailedError,
  UniwireProfileNotFoundError,
} from '../../../domain/uniwire/errors/uniwire.errors';
import { IncrementUserBalanceUseCase } from 'src/application/balance/use-cases/increment-user-balance.use-case';
import { randomUUID } from 'node:crypto';
import type { UniwireExchangeRate } from 'src/domain/uniwire/entities/uniwire.entity';

/**
 * Formats a crypto amount as a string for Uniwire `recipients[].amount`
 * (native units, not in-app coin balance).
 */
function formatAmountForPayout(value: number): string {
  const s = value.toFixed(8);
  return s.replace(/\.?0+$/, '') || '0';
}

/**
 * Client sends tickers (e.g. ETH, USDT); Uniwire's list often uses network-qualified symbols (e.g. WETH-ETH).
 */
const EXCHANGE_SYMBOL_ALIASES: Readonly<Record<string, readonly string[]>> = {
  ETH: ['WETH-ETH', 'WETH-MAINNET', 'WETH-BASE', 'WETH-POLYGON', 'WETH-ARBITRUM'],
  USDT: [
    'USDT-ETH',
    'TETHER-USD',
    'TETHER',
    'TETHER-USD-ETH-ERC20',
    'TETHER-ETH-ERC20',
  ],
  BTC: [],
  LTC: [],
  DOGE: [],
};

function findExchangeRateRow(
  rates: readonly UniwireExchangeRate[],
  clientSymbol: string,
): UniwireExchangeRate | undefined {
  const sym = clientSymbol.toUpperCase();
  const trySymbols = [sym, ...(EXCHANGE_SYMBOL_ALIASES[sym] ?? [])];
  for (const s of trySymbols) {
    const found = rates.find(
      (r) => r.symbol.toUpperCase() === s.toUpperCase(),
    );
    if (found) {
      return found;
    }
  }
  return undefined;
}

export interface CreatePayoutResult {
  readonly payoutId: string;
  readonly status: string;
}

export type CreatePayoutUseCaseResult =
  | { ok: true; value: CreatePayoutResult }
  | {
      ok: false;
      error:
        | UniwireApiError
        | UniwireProfileNotFoundError
        | UniwirePayoutFailedError;
    };

@Injectable()
export class CreatePayoutUseCase {
  private readonly logger = new Logger(CreatePayoutUseCase.name);

  constructor(
    @Inject(UNIWIRE_API_PORT)
    private readonly api: IUniwireApiPort,
    @Inject(UNIWIRE_REPOSITORY)
    private readonly repo: IUniwireRepository,
    @Inject(BALANCE_REPOSITORY)
    private readonly balanceRepo: IBalanceRepository,
    private readonly decrementUserBalanceUseCase: DecrementUserBalanceUseCase,
    private readonly incrementUserBalanceUseCase: IncrementUserBalanceUseCase,  
  ) {}

  async execute(cmd: CreatePayoutCommand): Promise<CreatePayoutUseCaseResult> {
    if (cmd.amount <= 0) {
      return Err(new UniwirePayoutFailedError('Amount must be positive'));
    }

    const currency = cmd.currency.toUpperCase();
    const kind = cmd.kind.toUpperCase();
    const symbol = cmd.symbol.toUpperCase();

    const profile = await this.repo.findInvoiceByUsernameAndCurrency(
      cmd.username,
      currency
    );
    if (!profile) {
      return Err(new UniwireProfileNotFoundError(cmd.username));
    }
    let decremented = false;
    try {
      const debitResult = await this.decrementUserBalanceUseCase.runDatabaseTransaction(
        cmd.username,
        cmd.amount,
      );
      if (!debitResult.ok) {
        if (debitResult.reason === 'insufficient_funds') {
          return Err(new UniwirePayoutFailedError('Insufficient balance'));
        }
        return Err(new UniwirePayoutFailedError('Invalid payout amount'));
      }else{
        decremented = true;
      }

      const latestBalance = await this.balanceRepo.findBalanceByUsername(
        cmd.username,
      );
      if (!latestBalance) {
        return Err(
          new UniwirePayoutFailedError('Unable to resolve user balance'),
        );
      }

      const exchangeRate = await this.api.getExchangeRates();
      this.logger.log(`Exchange rate: ${JSON.stringify(exchangeRate)}`);
      if (!exchangeRate?.result?.length) {
        return Err(new UniwirePayoutFailedError('Invalid exchange rate'));
      }
      const rateRow = findExchangeRateRow(exchangeRate.result, symbol);
      const exchangeRateValue = rateRow?.rate_usd;
      this.logger.log(
        `Lookup symbol=${symbol} -> apiSymbol=${rateRow?.symbol} rate_usd=${exchangeRateValue}`,
      );
      if (
        exchangeRateValue == null ||
        !Number.isFinite(exchangeRateValue) ||
        exchangeRateValue <= 0
      ) {
        return Err(new UniwirePayoutFailedError('Invalid exchange rate'));
      }
      const usdAmount =
        Math.round(
          (cmd.amount / parseFloat(process.env.COIN_TO_USD!)) * 100,
        ) / 100;
      this.logger.log(`COIN_TO_USD: ${process.env.COIN_TO_USD}`);
      this.logger.log(`USD amount: ${usdAmount}`);
      if (usdAmount <= 0) {
        return Err(new UniwirePayoutFailedError('Invalid exchange rate'));
      }
      const payoutAmount = usdAmount / exchangeRateValue;

      this.logger.log(`Payout amount (in ${currency}): ${payoutAmount}`);
      this.logger.log(`Payout currency: ${currency}`);
      this.logger.log(`Payout address: ${cmd.address}`);
      this.logger.log(`Payout kind: ${kind}`);
      this.logger.log(`Payout profileId: ${profile.profileId}`);
      this.logger.log(`Payout amount: ${cmd.amount}`);
      this.logger.log(`Payout username: ${cmd.username}`);
      this.logger.log(`Payout latestBalance: ${latestBalance.balance}`);
      this.logger.log(`Payout exchangeRate: ${exchangeRateValue}`);
      this.logger.log(`Payout usdAmount: ${usdAmount}`);
      if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
        return Err(new UniwirePayoutFailedError('Invalid payout amount'));
      }

      const referenceId = `payout-${randomUUID()}`;
      const recipientAmount = formatAmountForPayout(payoutAmount);

      const result = await this.api.createPayout({
        profileId: profile.profileId,
        kind,
        referenceId,
        passthrough: JSON.stringify({ username: cmd.username }),
        recipients: [
          {
            amount: usdAmount.toFixed(2),
            currency:"USD",
            address: cmd.address,
            notes: 'BloxBlitz withdrawal',
          },
        ],
      });

      await this.repo.createPayout({
        username: cmd.username,
        payoutId: result.payoutId,
        amount: cmd.amount,
        currency,
        status: result.status,
        balanceAfter: latestBalance.balance,
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
      if (decremented) {
        await this.incrementUserBalanceUseCase.execute(
          cmd.username,
          cmd.amount,
        );
      }
      return Err(new UniwireApiError(message));
    }
  }
}
