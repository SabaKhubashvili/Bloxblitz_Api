import { Injectable } from '@nestjs/common';
import type {
  IUniwireRepository,
  UniwireUserProfileRecord,
  UniwirePayoutRecord,
  UniwireInvoiceRecord,
} from '../../../../domain/uniwire/ports/uniwire.repository.port';

/**
 * Stub implementation of IUniwireRepository.
 *
 * Add Uniwire tables to Prisma schema and implement this repository
 * when ready. Until then, all methods throw.
 */
@Injectable()
export class PrismaUniwireRepository implements IUniwireRepository {
  async findProfileByUsername(_username: string): Promise<UniwireUserProfileRecord | null> {
    throw new Error('Uniwire repository not implemented: add UniwireUserProfile table and implement findProfileByUsername');
  }

  async upsertUserProfile(_username: string, _profileId: string): Promise<UniwireUserProfileRecord> {
    throw new Error('Uniwire repository not implemented: add UniwireUserProfile table and implement upsertUserProfile');
  }

  async createPayout(
    _data: Omit<UniwirePayoutRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UniwirePayoutRecord> {
    throw new Error('Uniwire repository not implemented: add UniwirePayout table and implement createPayout');
  }

  async findPayoutByPayoutId(_payoutId: string): Promise<UniwirePayoutRecord | null> {
    throw new Error('Uniwire repository not implemented: add UniwirePayout table and implement findPayoutByPayoutId');
  }

  async createInvoice(
    _data: Omit<UniwireInvoiceRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UniwireInvoiceRecord> {
    throw new Error('Uniwire repository not implemented: add UniwireInvoice table and implement createInvoice');
  }

  async findInvoiceByInvoiceId(_invoiceId: string): Promise<UniwireInvoiceRecord | null> {
    throw new Error('Uniwire repository not implemented: add UniwireInvoice table and implement findInvoiceByInvoiceId');
  }

  async updateInvoiceStatus(_invoiceId: string, _status: string): Promise<void> {
    throw new Error('Uniwire repository not implemented: implement updateInvoiceStatus');
  }
}
