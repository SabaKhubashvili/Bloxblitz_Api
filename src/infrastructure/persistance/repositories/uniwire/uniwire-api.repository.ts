import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  UniwireCreatePayoutResponse,
  UniwireExchangeRate,
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

/** Uniwire returns `rate_usd` as a decimal string in JSON; convert for numeric math. */
function parseUniwireDecimal(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : Number.NaN;
}

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
    const data = await this.request<{ result?: unknown[] }>('/v1/exchange-rates/');
    const rows = Array.isArray(data?.result) ? data.result : [];
    const result: UniwireExchangeRate[] = rows.map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: String(r.id ?? ''),
        kind: String(r.kind ?? ''),
        symbol: String(r.symbol ?? ''),
        rate_usd: parseUniwireDecimal(r.rate_usd),
        rate_btc: r.rate_btc != null ? String(r.rate_btc) : '',
        sign: r.sign != null ? String(r.sign) : '',
      };
    });
    return { result };
  }

  async createPayout(
    params: CreatePayoutParams,
  ): Promise<UniwireCreatePayoutResponse> {
    const payload: Record<string, unknown> = {
      profile_id: params.profileId,
      kind: params.kind,
      passthrough: params.passthrough,
      reference_id: params.referenceId,
      recipients: params.recipients.map((r) => {
        const row: Record<string, string> = {
          amount: r.amount,
          currency: r.currency,
          address: r.address,
        };
        if (r.notes != null && r.notes.length > 0) {
          row.notes = r.notes;
        }
        return row;
      }),
    };
    this.logger.log(`Create payout payload: ${JSON.stringify(payload)}`);

    const response = await this.request<
      | UniwireCreatePayoutResponse
      | { result?: { id?: string; status?: string } }
    >('/v1/payouts/', payload, 'POST');

    if ('payoutId' in response && 'status' in response) {
      return response;
    }

    const payoutId = response.result?.id;
    const status = response.result?.status;
    if (!payoutId || !status) {
      throw new UniwireApiError('Unexpected payout response format');
    }

    return { payoutId, status };
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
    return this.request<UniwireGetInvoiceResponse>(
      '/v1/invoices/',
      params,
      'POST',
    );
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
      kind: getUniwireInvoiceKind(currency.toString()),
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
