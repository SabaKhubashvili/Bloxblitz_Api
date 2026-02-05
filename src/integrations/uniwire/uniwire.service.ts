import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import {
  AssetType,
  AvailableCryptos,
  PaymentProviders,
  TransactionCategory,
  TransactionStatus,
} from '@prisma/client';
import axios, { Method } from 'axios';
import * as crypto from 'crypto';
import { coinKindMap } from 'src/common/constants/crypto/coin-kind-map';
import { PrismaService } from 'src/prisma/prisma.service';
import { CryptoCallbackDto } from './dto/uniwire-callback.dto';
import { CallbackStatus } from './types/callbackStatus.enum';
import { UserRepository } from 'src/public/modules/user/user.repository';
import { minConfirmationMap } from 'src/common/constants/crypto/min-coinfirmation-map';
import { RedisService } from 'src/provider/redis/redis.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { TransactionHistoryService } from 'src/public/modules/user/transaction-history/transaction-history.service';
import { DiscordNotificationService } from 'src/utils/discord_webhook.util';

@Injectable()
export class UniwireService {
  private readonly logger = new Logger(UniwireService.name);

  private readonly API_URL = process.env.UNIWIRE_API_URL!;
  private readonly API_KEY = process.env.UNIWIRE_API_KEY!;
  private readonly API_SECRET = process.env.UNIWIRE_API_SECRET!;
  private readonly PROFILE_ID = process.env.UNIWIRE_PROFILE_ID!;
  private readonly COIN_TO_USD = process.env.COIN_TO_USD!;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly userRepository: UserRepository,
    private readonly redisService: RedisService,
    private readonly transactionHistoryService: TransactionHistoryService,
    private readonly discordWebhookService: DiscordNotificationService,
  ) {}

  // ============================================================================
  // API Request Methods
  // ============================================================================

  private signPayload(payloadBase64: string): string {
    return crypto
      .createHmac('sha256', this.API_SECRET)
      .update(payloadBase64)
      .digest('hex');
  }

  async request<T = any>(
    endpoint: string,
    payload: Record<string, any> = {},
    method: Method = 'GET',
  ): Promise<T> {
    const nonce = Date.now().toString();

    const body = {
      ...payload,
      request: endpoint,
      nonce,
    };

    const encodedPayload = Buffer.from(JSON.stringify(body)).toString('base64');
    const signature = this.signPayload(encodedPayload);

    try {
      const response = await axios.request<T>({
        method,
        url: `${this.API_URL}${endpoint}`,
        headers: {
          'X-CC-KEY': this.API_KEY,
          'X-CC-PAYLOAD': encodedPayload,
          'X-CC-SIGNATURE': signature,
        },
      });

      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Uniwire API error: ${endpoint}`,
        error.response?.data || error.message,
      );
      throw new HttpException(
        error.response?.data || 'Uniwire API error',
        error.response?.status || HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================================================
  // Deposit Address Management
  // ============================================================================

  async getUserDepositAddr({
    coin,
    username,
  }: {
    coin: AvailableCryptos;
    username: string;
  }): Promise<{ address: string; recentTransactions: any[] }> {
    try {
      // Check for existing active address
      const existingAddr = await this.findExistingDepositAddress(
        username,
        coin,
      );
      console.log(`existing addr ${existingAddr}`);

      const recentTransactions = await this.getRecentDepositTransactions(
        username,
        coin,
      );
      if (existingAddr) {
        return { address: existingAddr, recentTransactions };
      }

      // Create new invoice and deposit address
      return await this.createNewDepositAddress(username, coin);
    } catch (error) {
      this.logger.error(
        `Error getting deposit address for user ${username}`,
        error.stack,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to get deposit address',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private async findExistingDepositAddress(
    username: string,
    coin: AvailableCryptos,
  ): Promise<string | null> {
    const existingAddr = await this.prismaService.userDepositAddress.findFirst({
      where: {
        userUsername: username,
        coin,
        isActive: true,
      },
    });

    return existingAddr?.address || null;
  }

  private async getRecentDepositTransactions(
    username: string,
    coin: AvailableCryptos,
  ) {
    const recentTransaction =
      await this.prismaService.cryptoTransaction.findMany({
        where: {
          username,
          currency: coin,
        },
        select: {
          coinAmountPaid: true,
          cryptoAmountPaid: true,
          confirmations: true,
          minConfirmations: true,
          isFullyConfirmed: true,
          txid: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });

    return recentTransaction;
  }

  private async createNewDepositAddress(
    username: string,
    coin: AvailableCryptos,
  ): Promise<{ address: string; recentTransactions: any[] }> {
    const kind = coinKindMap[coin];

    const response = await this.request<{
      result: { id: string; address: string; payment_url: string };
    }>(
      '/v1/invoices/',
      {
        profile_id: this.PROFILE_ID,
        currency: coin,
        kind,
        passthrough: {
          username,
        },
      },
      'POST',
    );

    const { id: invoiceId, address } = response.result;

    await this.prismaService.userDepositAddress.create({
      data: {
        userUsername: username,
        coin,
        address,
        invoiceId,
        lastUsedAt: new Date(),
        isActive: true,
      },
    });

    this.logger.log(
      `Created new deposit address for user ${username}, coin ${coin}`,
    );

    return { address, recentTransactions: [] };
  }

  // ============================================================================
  // Exchange Rates
  // ============================================================================

  async getExchangeRates() {
    try {
      const response = await this.request<{
        result: {
          id: string;
          kind: string;
          symbol: string;
          rate_usd: string;
          rate_btc: string;
          sign: string;
        }[];
      }>('/v1/exchange-rates/');

      const necessaryRates = response.result.filter((rate) =>
        Object.keys(coinKindMap).includes(rate.symbol),
      );

      const rates = [
        ...necessaryRates,
        {
          id: 'COIN',
          kind: 'coin',
          symbol: 'COIN',
          rate_usd: this.COIN_TO_USD,
          rate_btc: '0',
          sign: '$',
        },
      ];

      return { rates };
    } catch (error) {
      this.logger.error('Error fetching exchange rates', error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch exchange rates',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  // ============================================================================
  // Callback Processing
  // ============================================================================

  async processCallback(callbackData: CryptoCallbackDto): Promise<void> {
    try {
      this.logger.log(
        `Processing Uniwire callback - ID: ${callbackData.callback_id}, Status: ${callbackData.callback_status}`,
      );

      switch (callbackData.callback_status) {
        case CallbackStatus.TRANSACTION_PENDING:
          await this.handleTransactionPending(callbackData);
          break;
        case CallbackStatus.TRANSACTION_CONFIRMED:
          await this.handleTransactionConfirmed(callbackData);
          break;
        case CallbackStatus.TRANSACTION_COMPLETED:
          await this.handleTransactionComplete(callbackData);
          break;
        default:
          this.logger.warn(
            `Unknown callback status: ${callbackData.callback_status} for callback ${callbackData.callback_id}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Error processing callback ${callbackData.callback_id}`,
        error.stack,
      );
      throw new HttpException(
        'Failed to process Uniwire callback',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ============================================================================
  // Transaction Handlers
  // ============================================================================

  async handleTransactionPending(
    callbackData: CryptoCallbackDto,
  ): Promise<void> {
    this.validateCallbackData(callbackData);

    const {
      id: transactionId,
      txid,
      kind,
      invoice,
      amount,
      confirmations,
    } = callbackData.transaction!;

    this.validateInvoiceData(invoice, callbackData.callback_id);
    const { id: invoiceId, network, passthrough } = invoice;

    const usdAmount = this.extractUsdAmount(amount, callbackData.callback_id);
    this.logger.log(
      `Extracted USD amount: $${usdAmount} from transaction ${transactionId}`,
    );
    const username = this.extractUsername(
      passthrough,
      callbackData.callback_id,
    );

    this.logTransactionDetails({
      status: 'PENDING',
      txid,
      kind,
      createdAt: invoice.created_at,
      usdAmount,
      username,
      confirmations,
    });

    this.discordWebhookService.sendTransactionLog({
      transactionId,
      username,
      amountCoin: usdAmount * parseFloat(this.COIN_TO_USD),
      amountCrypto: amount.paid.amount,
      amountUsd: usdAmount,
      direction: 'IN',
      status: 'PENDING',
      provider: PaymentProviders.UNIWIRE,
    });

    await this.createPendingTransaction({
      invoiceId,
      transactionId,
      txid,
      currency: amount.paid.currency as AvailableCryptos,
      usdAmount,
      cryptoAmount: amount.paid.amount,
      network,
      username,
    });
    await this.redisService.mainClient.sAdd(
      RedisKeys.crypto.confirmations.active,
      transactionId,
    );
  }

  async handleTransactionConfirmed(
    callbackData: CryptoCallbackDto,
  ): Promise<void> {
    this.validateCallbackData(callbackData);

    const {
      id: transactionId,
      txid,
      confirmations,
      confirmed_at,
      amount,
      invoice,
    } = callbackData.transaction!;

    try {
      const existingTransaction = await this.findTransaction(transactionId);

      if (!existingTransaction) {
        throw new Error(`Transaction ${transactionId} not found in database`);
      }

      // Check if already confirmed or completed to prevent double-crediting
      if (['CONFIRMING', 'COMPLETED'].includes(existingTransaction.status)) {
        this.logger.warn(
          `Transaction ${transactionId} already processed (status: ${existingTransaction.status}) - skipping`,
        );
        return;
      }

      const usdAmount = this.extractUsdAmount(amount, callbackData.callback_id);
      const username = existingTransaction.username;
      if (!username) {
        throw new Error(
          `Transaction ${transactionId} has no associated username`,
        );
      }

      // Update transaction and credit user in a single database transaction
      await this.confirmTransactionAndCreditUser({
        transactionId,
        txid,
        confirmations,
        invoiceId: invoice.id,
        confirmedAt: confirmed_at
          ? new Date(confirmed_at).toISOString()
          : new Date().toISOString(),
        username,
        usdAmount,
      });
      this.discordWebhookService.sendTransactionLog({
        transactionId,
        username,
        amountCoin: usdAmount * parseFloat(this.COIN_TO_USD),
        amountCrypto: amount.paid.amount,
        amountUsd: usdAmount,
        direction: 'IN',
        status: 'COMPLETED',
        provider: PaymentProviders.UNIWIRE,
      });

      this.logger.log(
        `Transaction confirmed and user credited: TXID ${txid}, Confirmations: ${confirmations}, User: ${username}, Amount: $${usdAmount}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to confirm transaction ${transactionId}`,
        error.stack,
      );
      throw error;
    }
  }

  async handleTransactionComplete(
    callbackData: CryptoCallbackDto,
  ): Promise<void> {
    this.validateCallbackData(callbackData);

    const {
      id: transactionId,
      txid,
      invoice,
      confirmations,
      confirmed_at,
    } = callbackData.transaction!;

    this.validateInvoiceData(invoice, callbackData.callback_id);

    try {
      const existingTransaction = await this.findTransaction(transactionId);

      if (!existingTransaction) {
        throw new Error(`Transaction ${transactionId} not found in database`);
      }

      // Check if already completed
      if (existingTransaction.status === 'COMPLETED') {
        this.logger.warn(
          `Transaction ${transactionId} already marked as COMPLETED - skipping`,
        );
        return;
      }

      await this.completeTransaction({
        transactionId,
        txid,
        confirmations,
        confirmedAt: confirmed_at
          ? new Date(confirmed_at).toISOString()
          : new Date().toISOString(),
      });
      await this.redisService.mainClient.sRem(
        RedisKeys.crypto.confirmations.active,
        transactionId,
      );

      this.logger.log(
        `Transaction completed: TXID ${txid}, Confirmations: ${confirmations}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to complete transaction ${transactionId}`,
        error.stack,
      );
      throw error;
    }
  }

  // ============================================================================
  // Payout Processing
  // ============================================================================
  async createPayoutTransaction(params: {
    coin: AvailableCryptos;
    amount: string;
    address: string;
    username: string;
  }): Promise<{ payoutId: string; status: string }> {
    const { coin, amount, address, username } = params;

    try {
      const formattedAmount = this.formatCryptoAmount(amount, 8);

      const payload = {
        profile_id: this.PROFILE_ID,
        kind: coinKindMap[coin],
        passthrough: JSON.stringify({
          username,
          amount: formattedAmount,
          address,
        }),
        recipients: [
          {
            amount: formattedAmount,
            currency: coin,
            address,
          },
        ],
      };

      this.logger.log(`Creating payout: ${JSON.stringify(payload, null, 2)}`);

      const response = await this.request<{
        result: {
          id: string;
          status: string;
        };
      }>('/v1/payouts/', payload, 'POST');
      
      this.discordWebhookService.sendTransactionLog({
        transactionId: response.result.id,
        username,
        amountCrypto: parseFloat(formattedAmount),
        amountCoin: 'N/a',
        amountUsd: 'N/A',
        direction: 'OUT',
        status: response.result.status,
        provider: PaymentProviders.UNIWIRE,
      });
      return {
        payoutId: response.result.id,
        status: response.result.status,
      };
    } catch (error) {
      this.logger.error(
        `Error creating payout transaction for user ${username}`,
        error.stack,
      );
      throw error;
    }
  }
  formatCryptoAmount(amount: string, decimals: number): string {
    if (!amount.includes('.')) return amount;

    const [int, frac] = amount.split('.');
    return `${int}.${frac.slice(0, decimals)}`;
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  private async findTransaction(transactionId: string) {
    return await this.prismaService.cryptoTransaction.findUnique({
      where: { providerTransactionId: transactionId },
    });
  }

  private async createPendingTransaction(params: {
    invoiceId: string;
    transactionId: string;
    txid: string;
    currency: AvailableCryptos;
    usdAmount: number;
    cryptoAmount: number;
    network: string;
    username: string;
  }): Promise<void> {
    const {
      invoiceId,
      transactionId,
      txid,
      currency,
      usdAmount,
      cryptoAmount,
      network,
      username,
    } = params;

    try {
      await this.prismaService.cryptoTransaction.create({
        data: {
          invoiceId,
          providerTransactionId: transactionId,
          txid,
          currency,
          coinAmountPaid: usdAmount * parseFloat(this.COIN_TO_USD),
          cryptoAmountPaid: cryptoAmount,
          usdAmountPaid: usdAmount,
          network,
          status: 'PENDING',
          username,
          minConfirmations: minConfirmationMap[currency],
        },
      });
      await this.transactionHistoryService.addTransaction({
        username,
        direction: 'IN',
        category: TransactionCategory.CRYPTO,
        provider: PaymentProviders.UNIWIRE,
        coinAmountPaid: usdAmount * parseFloat(this.COIN_TO_USD),
        cryptoAmountPaid: cryptoAmount,
        usdAmountPaid: usdAmount,
        assetSymbol: currency,
        assetType: AssetType.CRYPTO,
        referenceId: transactionId,
        status: TransactionStatus.PENDING,
        balanceAfter: 0,
        referenceType: 'CRYPTO_TRANSACTION',
      });
      this.logger.log(
        `Crypto transaction created successfully for transaction ${transactionId}`,
      );
    } catch (error) {
      await this.redisService.mainClient.sRem(
        RedisKeys.crypto.confirmations.active,
        transactionId,
      );
      this.logger.error(
        `Failed to create crypto transaction for invoice ${invoiceId}`,
        error.stack,
      );
      throw error;
    }
  }

  private async confirmTransactionAndCreditUser(params: {
    transactionId: string;
    invoiceId: string;
    txid: string;
    confirmations: number;
    confirmedAt: string;
    username: string;
    usdAmount: number;
  }): Promise<void> {
    const {
      transactionId,
      invoiceId,
      confirmations,
      confirmedAt,
      username,
      usdAmount,
    } = params;

    await this.prismaService.$transaction(async (prisma) => {
      // Update transaction status to CONFIRMING
      await prisma.cryptoTransaction.update({
        where: { providerTransactionId: transactionId },
        data: {
          status: 'PENDING',
          confirmations,
          confirmedAt: confirmedAt ? new Date(confirmedAt) : new Date(),
          isFullyConfirmed: true,
        },
      });
      await this.prismaService.transactionHistory.updateMany({
        where: {
          referenceId: transactionId,
        },
        data: {
          status: 'COMPLETED',
        },
      });

      // Credit user if username is valid
      if (username !== 'unknown') {
        const coinAmount = usdAmount * parseFloat(this.COIN_TO_USD);
        await this.userRepository.processDeposit(username, coinAmount);

        this.logger.log(
          `User ${username} credited with ${coinAmount} coins ($${usdAmount})`,
        );
      } else {
        this.logger.warn(
          `Transaction ${transactionId} confirmed but username is unknown - cannot credit user`,
        );
      }
    });
  }

  private async completeTransaction(params: {
    transactionId: string;
    txid: string;
    confirmations: number;
    confirmedAt: string;
  }): Promise<void> {
    const { transactionId, confirmations, confirmedAt } = params;

    await this.prismaService.cryptoTransaction.update({
      where: { providerTransactionId: transactionId },
      data: {
        status: 'COMPLETED',
        confirmations,
        confirmedAt: confirmedAt ? new Date(confirmedAt) : new Date(),
      },
    });
  }

  // ============================================================================
  // Validation & Helper Methods
  // ============================================================================

  private validateCallbackData(callbackData: CryptoCallbackDto): void {
    if (!callbackData.transaction) {
      const error = `Callback ${callbackData.callback_id} missing transaction data for status ${callbackData.callback_status}`;
      this.logger.warn(error);
      throw new Error('Missing transaction data');
    }
  }

  private validateInvoiceData(invoice: any, callbackId: string): void {
    if (!invoice) {
      this.logger.warn(`Callback ${callbackId} missing invoice data`);
      throw new Error('Missing invoice data');
    }
  }

  private extractUsdAmount(amount: any, callbackId: string): number {
    if (!amount?.paid?.quotes?.['USD']) {
      this.logger.warn(
        `Callback ${callbackId} missing USD quote in transaction amount`,
      );
      throw new Error('Missing USD quote in transaction amount');
    }
    return amount.paid.quotes['USD'];
  }

  private extractUsername(passthrough: any, callbackId: string): string {
    if (!passthrough) {
      return 'unknown';
    }

    let parsedPassthrough: any = null;

    if (typeof passthrough === 'string') {
      try {
        parsedPassthrough = JSON.parse(passthrough);
      } catch {
        try {
          // Attempt to fix single quotes
          parsedPassthrough = JSON.parse(passthrough.replace(/'/g, '"'));
        } catch (e) {
          this.logger.warn(
            `Callback ${callbackId} has invalid passthrough format: ${passthrough}`,
          );
          return 'unknown';
        }
      }
    } else {
      parsedPassthrough = passthrough;
    }

    return parsedPassthrough?.username || 'unknown';
  }

  private logTransactionDetails(details: {
    status: string;
    txid: string;
    kind: string;
    createdAt: string;
    usdAmount: number;
    username: string;
    confirmations: number;
  }): void {
    this.logger.log(
      `Transaction ${details.status}: TXID ${details.txid}, Kind: ${details.kind}, ` +
        `Created: ${details.createdAt}, Amount: $${details.usdAmount}, ` +
        `User: ${details.username}, Confirmations: ${details.confirmations}`,
    );
  }
}
