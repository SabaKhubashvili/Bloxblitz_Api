import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type {
  UniwireCreatePayoutResponse,
  UniwireExchangeRates,
  UniwireGetCoinAddressResponse,
  UniwireRecentTransaction,
} from 'src/domain/uniwire/entities/uniwire.entity';
import type {
  CreateInvoiceParams,
  CreateInvoiceResult,
  CreatePayoutParams,
  IUniwireApiPort,
} from 'src/domain/uniwire/ports/uniwire-api.ports';
import axios from 'axios';
import { UniwireApiError } from 'src/domain/uniwire/errors/uniwire.errors';
import * as crypto from 'crypto';
import { Method } from 'axios';

@Injectable()
export class UniwireApiRepository implements IUniwireApiPort {
  private readonly baseUrl: string;
  private readonly API_URL = process.env.UNIWIRE_API_URL!;
  private readonly API_KEY = process.env.UNIWIRE_API_KEY!;
  private readonly API_SECRET = process.env.UNIWIRE_API_SECRET!;
  private readonly PROFILE_ID = process.env.UNIWIRE_PROFILE_ID!;
  private readonly COIN_TO_USD = process.env.COIN_TO_USD!;
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('UNIWIRE_API_URL') ?? '';
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
      request: `${endpoint}`,
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
     throw new UniwireApiError(error.message);
    }
  }
  async getExchangeRates(): Promise<UniwireExchangeRates> {
    return (await this.request<UniwireExchangeRates>('/v1/exchange-rates/'));
  }

  async createPayout(params: CreatePayoutParams): Promise<UniwireCreatePayoutResponse> {
    return this.request<UniwireCreatePayoutResponse>('payouts', params, 'POST');
  }

  async getTransactionConfirmations(ids: string[]): Promise<UniwireRecentTransaction[]> {
    const { data } = await firstValueFrom(
      this.httpService.post<UniwireRecentTransaction[]>(
        `${this.baseUrl}/v1/transactions/confirmations/`,
        { id: ids },
      ),
    );
    return Array.isArray(data) ? data : [];
  }

  async getCoinAddress(profileId: string): Promise<UniwireGetCoinAddressResponse> {
    const { data } = await firstValueFrom(
      this.httpService.get<UniwireGetCoinAddressResponse>(
        `${this.baseUrl}/v1/profiles/${profileId}/coin-address`,
      ),
    );
    return data;
  }

  async createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
    const { data } = await firstValueFrom(
      this.httpService.post<CreateInvoiceResult>(`${this.baseUrl}/v1/invoices/`, params),
    );
    return data;
  }
}