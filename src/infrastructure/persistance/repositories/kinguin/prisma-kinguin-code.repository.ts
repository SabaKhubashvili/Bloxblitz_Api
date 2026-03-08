import { Injectable } from '@nestjs/common';
import { KinguinCodeStatus, type Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IKinguinCodeRepository,
  KinguinCodeRecord,
  RedeemCodeData,
} from '../../../../domain/kinguin/ports/kinguin-code.repository.port';

function toNumber(d: { toNumber: () => number } | number): number {
  return typeof d === 'number' ? d : d.toNumber();
}

function toDomain(row: {
  id: string;
  code: string;
  value: { toNumber: () => number } | number;
  status: string;
  isRedeemed: boolean;
  redeemedBy: string | null;
  redeemedAt: Date | null;
  expiresAt: Date | null;
  batchId: string | null;
  createdAt: Date;
}): KinguinCodeRecord {
  return {
    id: row.id,
    code: row.code,
    value: toNumber(row.value),
    status: row.status,
    isRedeemed: row.isRedeemed,
    redeemedBy: row.redeemedBy,
    redeemedAt: row.redeemedAt,
    expiresAt: row.expiresAt,
    batchId: row.batchId,
    createdAt: row.createdAt,
  };
}

@Injectable()
export class PrismaKinguinCodeRepository implements IKinguinCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByCode(codeHash: string): Promise<KinguinCodeRecord | null> {
    const row = await this.prisma.kinguinPromoCode.findUnique({
      where: { code: codeHash },
    });
    return row ? toDomain(row) : null;
  }

  async redeemCode(
    id: string,
    batchId: string | null,
    data: RedeemCodeData,
  ): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.kinguinPromoCode.update({
        where: { id },
        data: {
          isRedeemed: true,
          redeemedBy: data.username,
          redeemedAt: now,
          status: KinguinCodeStatus.REDEEMED,
        },
      });
      await tx.kinguinRedemptionLog.create({
        data: {
          codeId: id,
          userUsername: data.username,
          ipAddress: data.ipAddress ?? null,
          userAgent: data.userAgent ?? null,
          creditsBefore: data.creditsBefore,
          creditsAfter: data.creditsAfter,
          creditAmount: data.creditAmount,
        },
      });
      if (batchId) {
        await tx.kinguinCodeBatch.update({
          where: { id: batchId },
          data: { codesRedeemed: { increment: 1 } },
        });
      }
    });
  }

  async disableCode(codeHash: string): Promise<boolean> {
    try {
      await this.prisma.kinguinPromoCode.update({
        where: { code: codeHash },
        data: { status: KinguinCodeStatus.DISABLED },
      });
      return true;
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return false;
      }
      throw err;
    }
  }

  async createMany(
    codes: Array<{ code: string; value: number; expiresAt?: Date; batchId: string }>,
  ): Promise<void> {
    await this.prisma.kinguinPromoCode.createMany({
      data: codes.map((c) => ({
        code: c.code,
        value: c.value,
        expiresAt: c.expiresAt ?? null,
        batchId: c.batchId,
      })),
      skipDuplicates: true,
    });
  }

  async findByBatch(params: {
    batchId: string;
    page: number;
    limit: number;
    status?: string;
  }): Promise<{ items: KinguinCodeRecord[]; total: number }> {
    const where: Prisma.KinguinPromoCodeWhereInput = {
      batchId: params.batchId,
      ...(params.status
        ? { status: params.status as KinguinCodeStatus }
        : {}),
    };
    const skip = (params.page - 1) * params.limit;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.kinguinPromoCode.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.kinguinPromoCode.count({ where }),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async countByStatus(): Promise<Record<string, number>> {
    const groups = await this.prisma.kinguinPromoCode.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    return Object.fromEntries(groups.map((g) => [g.status, g._count.status]));
  }
}
