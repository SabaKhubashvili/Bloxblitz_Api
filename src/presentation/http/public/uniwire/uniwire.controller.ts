import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../shared/filters/domain-exception.filter';
import { GetExchangeRatesUseCase } from '../../../../application/uniwire/use-cases/get-exchange-rates.use-case';
import { GetTransactionConfirmationsUseCase } from '../../../../application/uniwire/use-cases/get-transaction-confirmations.use-case';
import { CreateDepositInvoiceUseCase } from '../../../../application/uniwire/use-cases/create-deposit-invoice.use-case';
import { CreatePayoutUseCase } from '../../../../application/uniwire/use-cases/create-payout.use-case';
import { GetDepositAddressUseCase } from '../../../../application/uniwire/use-cases/get-deposit-address.use-case';
import { CreatePayoutDto } from './dto/create-payout.dto';
import { GetTransactionConfirmationsDto } from './dto/get-transaction-confirmations.dto';
import { UniwireAddressNotFoundError } from 'src/domain/uniwire/errors/uniwire.errors';
import { isSupportedCurrency } from 'src/domain/uniwire/services/uniwire-helpers.service';
import { UniwireCallbackGuard } from 'src/shared/guards/uniwire-callback.guard';
import { UniwireCallbackDto } from './dto/handle-uniwire-callback.dto';
import { UniwireCallbackStatus } from 'src/domain/uniwire/entities/uniwire.entity';
import { HandleTransactionPendingUseCase } from 'src/application/uniwire/use-cases/handle-transaction-pending.use-case';
import { HandleTransactionConfirmedUseCase } from 'src/application/uniwire/use-cases/handle-transaction-confirmed.use-case';
import { HandleTransactionCompletedUseCase } from 'src/application/uniwire/use-cases/handle-transaction-completed.use-case';

/**
 * Uniwire payment endpoints.
 *
 * - GET  /uniwire/exchange-rates     — fetch exchange rates (JWT)
 * - GET  /uniwire/deposit/address     — get user's deposit address (JWT)
 * - POST /uniwire/deposit/invoice     — create deposit invoice (JWT)
 * - POST /uniwire/payout              — create payout/withdrawal (JWT)
 * - POST /uniwire/transactions/confirmations — check transaction status (JWT)
 */
@Controller('wallet')
@UseFilters(DomainExceptionFilter)
export class UniwireController {
  constructor(
    private readonly getExchangeRatesUseCase: GetExchangeRatesUseCase,
    private readonly getTransactionConfirmationsUseCase: GetTransactionConfirmationsUseCase,
    private readonly createPayoutUseCase: CreatePayoutUseCase,
    private readonly getDepositAddressUseCase: GetDepositAddressUseCase,
    private readonly handleTransactionPendingUseCase: HandleTransactionPendingUseCase,
    private readonly handleTransactionConfirmedUseCase: HandleTransactionConfirmedUseCase,
    private readonly handleTransactionCompletedUseCase: HandleTransactionCompletedUseCase,
  ) {}

  @Get('exchange-rates')
  @HttpCode(HttpStatus.OK)
  async getExchangeRates() {
    const result = await this.getExchangeRatesUseCase.execute();
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get('deposit/address/:currency')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getDepositAddress(
    @CurrentUser() user: JwtPayload,
    @Param('currency') currency: string,
  ) {
    const currencyCode = currency.toUpperCase();
    if (!isSupportedCurrency(currencyCode)) {
      console.log('Currency not supported');
      throw new UniwireAddressNotFoundError();
    }

    const result = await this.getDepositAddressUseCase.execute({
      username: user.username,
      currency: currencyCode,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('payout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPayout(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreatePayoutDto,
  ) {
    const result = await this.createPayoutUseCase.execute({
      username: user.username,
      amount: body.amount,
      currency: body.currency,
      kind: body.kind,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('transactions/confirmations')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async getTransactionConfirmations(
    @Body() body: GetTransactionConfirmationsDto,
  ) {
    const result = await this.getTransactionConfirmationsUseCase.execute({
      transactionIds: body.transactionIds,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @UseGuards(UniwireCallbackGuard)
  async callback(@Body() body: UniwireCallbackDto) {
    if (body.callback_status === UniwireCallbackStatus.INVOICE_COMPLETED) {
      // const result = await this.getTransactionConfirmationsUseCase.execute({
      //   transactionIds: [body.transaction?.id ?? ''],
      // });
      // if (!result.ok) throw result.error;
      // return result.value;
    } else if (body.callback_status === UniwireCallbackStatus.INVOICE_PENDING) {
      // const result = await this.createDepositInvoiceUseCase.execute({
      //   invoiceId: body.invoice?.id ?? '',
      // });
      // if (!result.ok) throw result.error;
      // return result.value;
    } else if (
      body.callback_status === UniwireCallbackStatus.INVOICE_CONFIRMED
    ) {
      // const result = await this.createDepositInvoiceUseCase.execute({
      //   invoiceId: body.invoice.id,
      // });
      // if (!result.ok) throw result.error;
      // return result.value;
    } else if (
      body.callback_status === UniwireCallbackStatus.PAYOUT_CONFIRMED
    ) {
      // const result = await this.createPayoutUseCase.execute({
      //   payoutId: body.payout.id,
      // });
      // if (!result.ok) throw result.error;
      // return result.value;
    } else if (
      body.callback_status === UniwireCallbackStatus.TRANSACTION_PENDING
    ) {
      const result = await this.handleTransactionPendingUseCase.execute(body);
      if (!result.ok) throw result.error;
      return result.value;
    } else if (
      body.callback_status === UniwireCallbackStatus.TRANSACTION_CONFIRMED
    ) {
      const result = await this.handleTransactionConfirmedUseCase.execute(body);
      if (!result.ok) throw result.error;
      return result.value;
    } else if (
      body.callback_status === UniwireCallbackStatus.TRANSACTION_COMPLETED
    ) {
      const result = await this.handleTransactionCompletedUseCase.execute(body);
      if (!result.ok) throw result.error;
      return result.value;
    } else if (
      body.callback_status === UniwireCallbackStatus.PAYOUT_COMPLETED
    ) {
      // const result = await this.createPayoutUseCase.execute({
      //   payoutId: body.payout?.id ?? '',
      // });
      // if (!result.ok) throw result.error;
      // return result.value;
    } else if (
      body.callback_status === UniwireCallbackStatus.PAYOUT_COMPLETED
    ) {
      // const result = await this.createPayoutUseCase.execute({
      //   payoutId: body.payout?.id ?? '',
      // });
      // if (!result.ok) throw result.error;
      // return result.value;
    }
    return {
      message: 'Callback received',
    };
  }
}
