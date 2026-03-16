import { Injectable } from '@nestjs/common';
import type {
  IUniwireRepository,
  UniwirePayoutRecord,
  UniwireInvoiceRecord,
} from '../../../../domain/uniwire/ports/uniwire.repository.port';
import { AvailableCryptos, UserDepositAddress } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getUniwireInvoiceKind } from 'src/domain/uniwire/services/uniwire-helpers.service';

function toDomain(prisma: UserDepositAddress): UniwireInvoiceRecord {
  return {
    userUsername: prisma.userUsername,
    currency: prisma.coin,
    kind: getUniwireInvoiceKind(prisma.coin.toString()),
    address: prisma.address,
    profileId: prisma.profileId,
    invoiceId: prisma.invoiceId ?? null,
    lastUsedAt: prisma.lastUsedAt ?? null,
  };
}
/**
 * Stub implementation of IUniwireRepository.
 *
 * Add Uniwire tables to Prisma schema and implement this repository
 * when ready. Until then, all methods throw.
 */
@Injectable()
export class PrismaUniwireRepository implements IUniwireRepository {
  constructor(private readonly prisma: PrismaService) {}
  async findInvoiceByUsernameAndCurrency(username: string, currency: string): Promise<UniwireInvoiceRecord | null> {
    const normalized = currency.toUpperCase() as AvailableCryptos;
    const record = await this.prisma.userDepositAddress.findMany({
      where: {
        userUsername: username,
        coin: normalized,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1,
    });
    return record.length > 0 ? toDomain(record[0]) : null;
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
    data: Omit<UniwireInvoiceRecord,  'createdAt' | 'updatedAt'>,
  ): Promise<UniwireInvoiceRecord> {
    const record = await this.prisma.userDepositAddress.create({
      data: {
        userUsername: data.userUsername,
        coin: data.currency,
        address: data.address,
        invoiceId: data.invoiceId ?? null,
        kind: data.kind,
        lastUsedAt: data.lastUsedAt ?? undefined,
        profileId: data.profileId,
      },
    });
    return toDomain(record);
  }

  async findInvoiceByInvoiceId(_invoiceId: string): Promise<UniwireInvoiceRecord | null> {
    throw new Error('Uniwire repository not implemented: add UniwireInvoice table and implement findInvoiceByInvoiceId');
  }

  async updateInvoiceStatus(_invoiceId: string, _status: string): Promise<void> {
    throw new Error('Uniwire repository not implemented: implement updateInvoiceStatus');
  }
}
