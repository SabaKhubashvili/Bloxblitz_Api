import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { KinguinProvider } from './kinguin.provider';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { ConfigService } from '@nestjs/config';
import { generateNewKinguinCodesResult } from '../contracts/generate-new-kinguin-codes-result';
import { getKinguinOffersResult } from '../contracts/get-kinguin-offers-result';

@Injectable()
export class KinguinApiProvider implements KinguinProvider {
  private readonly logger = new Logger(KinguinApiProvider.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  private clientId: string;
  private clientSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('KINGUIN_CLIENT_ID')!;
    this.clientSecret = this.configService.get<string>(
      'KINGUIN_CLIENT_SECRET',
    )!;
  }

  private async fetchAccessToken(): Promise<void> {
    try {
      const response = await axios.post(
        'https://id.kinguin.net/auth/token',
        {
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? `Kinguin token fetch failed: ${error.response?.status} - ${error.response?.data}`
          : 'Unknown error while fetching Kinguin token';
      this.logger.error(message);
      throw new InternalServerErrorException(message);
    }
  }

  private async ensureToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiry - 5000) {
      await this.fetchAccessToken();
    }
  }

  public async get<T>(url: string, params?: any): Promise<T> {
    try {
      await this.ensureToken();
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        params,
      });
      return response.data;
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? `Kinguin GET request failed: ${error.response?.status} - ${error.response?.data}`
          : 'Unknown error during GET request';
      this.logger.error(message);
      throw new InternalServerErrorException(message);
    }
  }

  public async post<T>(url: string, body: any): Promise<T> {
    try {
      await this.ensureToken();
      const response = await axios.post(url, body, {
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return response.data;
    } catch (error) {
      const message =
        error instanceof AxiosError
          ? `Kinguin POST request failed: ${error.response?.status} - ${error.response?.data}`
          : 'Unknown error during POST request';
      this.logger.error(message);
      throw new InternalServerErrorException(message);
    }
  }

  async createCodes(
    codes: { raw: string; hashed: string; balanceAmount: number }[],
  ): Promise<generateNewKinguinCodesResult> {
    try {
      await this.post(
        'https://gateway.kinguin.net/sales-manager-api/api/v1/offers/682f0596b1bb8f04c9b78bb1/stock/list',
        codes.map((c) => ({
          body: c.raw,
          mimeType: 'text/plain',
        })),
      );

      return { success: true, generatedCodesCount: codes.length };
    } catch (error) {
      const message = `Failed to create Kinguin codes: ${error instanceof Error ? JSON.stringify(error.message) : JSON.stringify(error)}`;
      this.logger.error(message);
      throw new InternalServerErrorException(message);
    }
  }

  async getKinguinOffers(): Promise<getKinguinOffersResult> {
    try {
      const offers = await this.get<any>(
        'https://gateway.kinguin.net/sales-manager-api/api/v1/offers/',
      );
      
      return {
        offers: offers._embedded.offerList.map((offer: any) => ({
          offerId: offer.id,
          productId: offer.productId,
          name: offer.name,
          status: offer.status,
          sold: offer.sold,
          unitPrice: offer.unitPrice,
          availableStock: offer.availableStock,
          buyableStock: offer.buyableStock,
          createdAt: offer.createdAt,
          updatedAt: offer.updatedAt,
          region: offer.productDetails?.region?.name,
          platform: offer.productDetails?.platform?.name,
          imageUrl: offer.productDetails?.imageUrl,
          merchantType: offer.merchantType,
          preOrder: offer.preOrder,
        })),
        totalActive: offers.summary.totalActive,
        totalActiveWithoutStock: offers.summary.totalActiveWithoutStock,
        totalInactive: offers.summary.totalInactive,
        totalBlock: offers.summary.totalBlock,
        totalFavorite: offers.summary.totalFavorite,
        totalManualVerification: offers.summary.totalManualVerification,
        totalPrePurchaseStock: offers.summary.totalPrePurchaseStock,
        totalSpaActive: offers.summary.totalSpaActive,
      };
    } catch (error) {
      this.logger.error('Error fetching Kinguin offers', error);
      throw new InternalServerErrorException('Failed to fetch Kinguin offers');
    }
  }
}
