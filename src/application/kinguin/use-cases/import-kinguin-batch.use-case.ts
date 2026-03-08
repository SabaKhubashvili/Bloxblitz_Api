import { Injectable, Inject, Logger } from '@nestjs/common';
import { Ok, Err } from '../../../domain/shared/types/result.type';
import { KinguinBatchImportError } from '../../../domain/kinguin/errors/kinguin.errors';
import {
  KINGUIN_CODE_REPOSITORY,
  KINGUIN_BATCH_REPOSITORY,
} from '../tokens/kinguin.tokens';
import type { IKinguinCodeRepository } from '../../../domain/kinguin/ports/kinguin-code.repository.port';
import type { IKinguinBatchRepository } from '../../../domain/kinguin/ports/kinguin-batch.repository.port';
import { hashCode } from '../../../shared/utils/kinguin-hash.util';

export interface ImportKinguinBatchCommand {
  batchName: string;
  purchaseDate: Date;
  codes: Array<{ code: string; value: number; expiresAt?: Date }>;
  notes?: string;
}

export interface ImportKinguinBatchResult {
  batchId: string;
  totalCodes: number;
  totalValue: number;
}

/**
 * Imports a batch of Kinguin promo codes.
 * Raw codes are hashed with SHA-256 before saving — only hashes are stored.
 */
@Injectable()
export class ImportKinguinBatchUseCase {
  private readonly logger = new Logger(ImportKinguinBatchUseCase.name);

  constructor(
    @Inject(KINGUIN_CODE_REPOSITORY)
    private readonly codeRepo: IKinguinCodeRepository,
    @Inject(KINGUIN_BATCH_REPOSITORY)
    private readonly batchRepo: IKinguinBatchRepository,
  ) {}

  async execute(cmd: ImportKinguinBatchCommand): Promise<
    | { ok: true; value: ImportKinguinBatchResult }
    | { ok: false; error: KinguinBatchImportError }
  > {
    try {
      const totalCodes = cmd.codes.length;
      const totalValue = Math.round(
        cmd.codes.reduce((sum, c) => sum + c.value, 0) * 100,
      ) / 100;

      const batch = await this.batchRepo.create({
        batchName: cmd.batchName,
        purchaseDate: cmd.purchaseDate,
        totalCodes,
        totalValue,
        notes: cmd.notes,
      });

      const codesToSave = cmd.codes.map((c) => ({
        code: hashCode(c.code.trim()),
        value: c.value,
        expiresAt: c.expiresAt,
        batchId: batch.id,
      }));

      await this.codeRepo.createMany(codesToSave);

      this.logger.log(
        `Batch imported — id=${batch.id} name=${cmd.batchName} codes=${totalCodes} value=${totalValue}`,
      );

      return Ok({ batchId: batch.id, totalCodes, totalValue });
    } catch (err) {
      this.logger.error('Batch import failed', err);
      return Err(new KinguinBatchImportError(String(err)));
    }
  }
}
