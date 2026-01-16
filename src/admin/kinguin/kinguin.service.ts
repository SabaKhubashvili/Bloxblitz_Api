import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { KinguinApiProvider } from './providers/kinguin-api.provider';
import { generateKinguinCode } from './domain/kinguin-code.generator';
import { createBatches } from 'src/domain/batch.generator';
import { AxiosError } from 'axios';
import { getKinguinOffersResult } from './contracts/get-kinguin-offers-result';

@Injectable()
export class KinguinService {
  private readonly logger = new Logger(KinguinService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly kinguinApiProvider: KinguinApiProvider,
  ) {}

  /**
   * Generates new Kinguin codes and stores them in DB as hashed codes.
   * Returns the raw codes (not stored) for sending to users.
   */
  async generateNewKinguinCodes(
    balanceAmount: number,
    quantity: number,
  ): Promise<{ totalGenerated: number; success: boolean; message: string }> {
    // 1️⃣ Generate all codes in memory
    const generatedCodes: {
      raw: string;
      hashed: string;
      balanceAmount: number;
    }[] = [];
    for (let i = 0; i < quantity; i++) {
      const code = generateKinguinCode(balanceAmount);
      generatedCodes.push({
        raw: code.raw,
        hashed: code.hashed,
        balanceAmount: balanceAmount,
      });
    }

    // 2️⃣ Split into batches
    const batchedCodes = createBatches(generatedCodes, 50);

    // 3️⃣ Insert each batch into DB (store only hashed code)
    try {
      // 1. Insert codes into DB
      for (const batch of batchedCodes) {
        await this.prisma.kinguinPromoCode.createMany({
          data: batch.map((c) => ({
            code: c.hashed,
            value: balanceAmount,
          })),
          skipDuplicates: true,
        });
      }

      // 2. Sync with Kinguin
      await this.kinguinApiProvider.createCodes(generatedCodes);
    } catch (error) {
      this.logger.error('Error generating or syncing Kinguin codes', error);

      // Optional rollback: remove codes from DB if Kinguin sync failed
      if (error instanceof AxiosError) {
        const hashedCodes = generatedCodes.map((c) => c.hashed);
        await this.prisma.kinguinPromoCode.deleteMany({
          where: { code: { in: hashedCodes } },
        });
      }

      throw new InternalServerErrorException(
        'Failed to generate or sync Kinguin codes',
      );
    }

    // 4️⃣ Return raw + hashed for immediate use
    return {
      success: true,
      totalGenerated: generatedCodes.length,
      message: `Successfully generated and synced ${generatedCodes.length} Kinguin codes.`,
    };
  }

  async getKinguinOffers(): Promise<getKinguinOffersResult> {
    return await this.kinguinApiProvider.getKinguinOffers();
  }
}
