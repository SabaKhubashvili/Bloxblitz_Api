import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IKinguinBatchRepository,
  KinguinBatchRecord,
} from '../../../../domain/kinguin/ports/kinguin-batch.repository.port';

function toNumber(d: { toNumber: () => number } | number): number {
  return typeof d === 'number' ? d : d.toNumber();
}

function toDomain(row: {
  id: string;
  batchName: string;
  purchaseDate: Date;
  totalCodes: number;
  totalValue: { toNumber: () => number } | number;
  codesRedeemed: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): KinguinBatchRecord {
  return {
    id: row.id,
    batchName: row.batchName,
    purchaseDate: row.purchaseDate,
    totalCodes: row.totalCodes,
    totalValue: toNumber(row.totalValue),
    codesRedeemed: row.codesRedeemed,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaKinguinBatchRepository implements IKinguinBatchRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    batchName: string;
    purchaseDate: Date;
    totalCodes: number;
    totalValue: number;
    notes?: string;
  }): Promise<KinguinBatchRecord> {
    const row = await this.prisma.kinguinCodeBatch.create({
      data: {
        batchName: data.batchName,
        purchaseDate: data.purchaseDate,
        totalCodes: data.totalCodes,
        totalValue: data.totalValue,
        notes: data.notes ?? null,
      },
    });
    return toDomain(row);
  }

  async findMany(): Promise<KinguinBatchRecord[]> {
    const rows = await this.prisma.kinguinCodeBatch.findMany({
      orderBy: { purchaseDate: 'desc' },
    });
    return rows.map(toDomain);
  }
}
