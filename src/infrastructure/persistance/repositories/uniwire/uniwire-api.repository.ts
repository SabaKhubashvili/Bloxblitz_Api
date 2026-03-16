import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  UniwireCreatePayoutResponse,
  UniwireExchangeRates,
  UniwireGetInvoiceResponse,
  UniwireRecentTransaction,
  UniwireCreateDepositAddressResponse,
} from 'src/domain/uniwire/entities/uniwire.entity';
import type {
  CreateInvoiceParams,
  CreatePayoutParams,
  IUniwireApiPort,
  UniwireInvoiceKind,
} from 'src/domain/uniwire/ports/uniwire-api.ports';
import axios from 'axios';
import { UniwireApiError } from 'src/domain/uniwire/errors/uniwire.errors';
import * as crypto from 'crypto';
import { Method } from 'axios';
import { getUniwireInvoiceKind } from 'src/domain/uniwire/services/uniwire-helpers.service';
import { AvailableCryptos } from '@prisma/client';

@Injectable()
export class UniwireApiRepository implements IUniwireApiPort {
  private readonly logger = new Logger(UniwireApiRepository.name);
  private readonly baseUrl: string;
  private readonly API_URL = process.env.UNIWIRE_API_URL!;
  private readonly API_KEY = process.env.UNIWIRE_API_KEY!;
  private readonly API_SECRET = process.env.UNIWIRE_API_SECRET!;
  private readonly PROFILE_ID = process.env.UNIWIRE_PROFILE_ID!;
  private readonly COIN_TO_USD = process.env.COIN_TO_USD!;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('UNIWIRE_API_URL') ?? '';
    if (!this.baseUrl || this.baseUrl.length === 0) {
      throw new Error('UNIWIRE_API_URL is not set');
    }
  }
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
      throw new UniwireApiError(error.message);
    }
  }
  async getExchangeRates(): Promise<UniwireExchangeRates> {
    return await this.request<UniwireExchangeRates>('/v1/exchange-rates/');
  }

  async createPayout(
    params: CreatePayoutParams,
  ): Promise<UniwireCreatePayoutResponse> {
    return this.request<UniwireCreatePayoutResponse>(
      '/v1/payouts/',
      params,
      'POST',
    );
  }

  async getTransactionConfirmations(
    ids: string[],
  ): Promise<UniwireRecentTransaction[]> {
    const data = await this.request<
      UniwireRecentTransaction[] | { data?: UniwireRecentTransaction[] }
    >('/v1/transactions/confirmations/', { id: ids }, 'POST');
    return Array.isArray(data)
      ? data
      : ((data as { data?: UniwireRecentTransaction[] }).data ?? []);
  }

  async getInvoiceAddress(
    invoiceId: string,
  ): Promise<UniwireGetInvoiceResponse> {
    return this.request<UniwireGetInvoiceResponse>(`/v1/invoices/${invoiceId}`);
  }

  async createInvoice(
    params: CreateInvoiceParams,
  ): Promise<UniwireGetInvoiceResponse> {
    return this.request<UniwireGetInvoiceResponse>('/v1/invoices/', params, 'POST');
  }

  async createDepositAddress(
    currency: AvailableCryptos,
    passthrough: Record<string, string>,
  ): Promise<UniwireCreateDepositAddressResponse> {
    const profileId =
      this.PROFILE_ID ?? this.configService.get<string>('UNIWIRE_PROFILE_ID');
    if (!profileId) {
      throw new UniwireApiError('UNIWIRE_PROFILE_ID is not configured');
    }

    const result = await this.createInvoice({
      profile_id: profileId,
      currency: currency.toUpperCase(),
      kind: getUniwireInvoiceKind(currency.toString()) as UniwireInvoiceKind,
      passthrough: {
        ...passthrough,
      },
    });
    return {
      address: result.result.address,
      network: result.result.network,
      invoiceId: result.result.id,
      profileId: result.result.profile_id,
    };
  }
}
