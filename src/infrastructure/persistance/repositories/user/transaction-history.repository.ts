import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  TransactionCategory,
  TransactionDirection,
  TransactionStatus,
  AssetType,
  ReferenceType,
  PaymentProviders,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  ITransactionHistoryRepository,
  TransactionRecord,
  TransactionPage,
  TransactionHistorySortOrder,
  TransactionHistoryFilters,
} from '../../../../domain/user/ports/transaction-history.repository.port';

// ─── Prisma row type ──────────────────────────────────────────────────────────

type TxRow = Prisma.TransactionHistoryGetPayload<object>;

// ─── Repository ───────────────────────────────────────────────────────────────

@Injectable()
export class PrismaTransactionHistoryRepository implements ITransactionHistoryRepository {
  private readonly logger = new Logger(PrismaTransactionHistoryRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── findPageByUsername ───────────────────────────────────────────────────────

  async findPageByUsername(
    username: string,
    page: number,
    limit: number,
    order: TransactionHistorySortOrder,
    filters: TransactionHistoryFilters,
  ): Promise<TransactionPage> {
    const skip = (page - 1) * limit;
    const where = buildWhereClause(username, filters);

    // Single round-trip: count + data in one $transaction
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.transactionHistory.findMany({
        where,
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      this.prisma.transactionHistory.count({ where }),
    ]);

    return {
      items: rows.map(toDomain),
      total,
    };
  }

  // ── findByIdAndUsername ──────────────────────────────────────────────────────

  async findByIdAndUsername(
    id: string,
    username: string,
  ): Promise<TransactionRecord | null> {
    const row = await this.prisma.transactionHistory.findFirst({
      where: { id, userUsername: username },
    });

    return row ? toDomain(row) : null;
  }

  // ── create ───────────────────────────────────────────────────────────────────

  async create(
    data: Omit<TransactionRecord, 'id' | 'createdAt'>,
  ): Promise<TransactionRecord> {
    const row = await this.prisma.transactionHistory.create({
      data: {
        userUsername: data.userUsername,
        category: data.category as TransactionCategory,
        direction: data.direction as TransactionDirection,
        provider: data.provider as PaymentProviders,
        status: data.status as TransactionStatus,
        usdAmountPaid: new Prisma.Decimal(data.usdAmountPaid),
        cryptoAmountPaid: new Prisma.Decimal(data.cryptoAmountPaid),
        coinAmountPaid: new Prisma.Decimal(data.coinAmountPaid),
        balanceAfter: new Prisma.Decimal(data.balanceAfter),
        assetType: data.assetType as AssetType,
        assetSymbol: data.assetSymbol ?? null,
        referenceType: data.referenceType as ReferenceType,
        referenceId: data.referenceId,
        metadata: (data.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      },
    });

    this.logger.log(
      `[TxRepo] Created transaction id="${row.id}" user="${row.userUsername}" ` +
        `category="${row.category}" direction="${row.direction}" amount=${row.coinAmountPaid}`,
    );

    return toDomain(row);
  }
}

// ─── Where-clause builder ─────────────────────────────────────────────────────

/**
 * Builds the Prisma `where` object from the username + optional filters.
 *
 * Only fields that are present (non-undefined) are added to the clause so
 * Prisma does not generate unnecessary `IS NOT NULL` conditions.
 */
function buildWhereClause(
  username: string,
  filters: TransactionHistoryFilters,
): Prisma.TransactionHistoryWhereInput {
  const where: Prisma.TransactionHistoryWhereInput = {
    userUsername: username,
  };

  if (filters.category) {
    where.category = filters.category as TransactionCategory;
  }

  if (filters.direction) {
    where.direction = filters.direction as TransactionDirection;
  }

  if (filters.status) {
    where.status = filters.status as TransactionStatus;
  }

  if (filters.assetType) {
    where.assetType = filters.assetType as AssetType;
  }

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from && { gte: filters.from }),
      ...(filters.to && { lte: filters.to }),
    };
  }

  return where;
}

// ─── Row → Domain mapper ──────────────────────────────────────────────────────

/**
 * Maps a raw Prisma row to the domain `TransactionRecord` interface.
 *
 * Prisma returns `Decimal` objects for numeric columns — we resolve them to
 * plain `number` here so nothing above this layer ever sees a Prisma type.
 */
function toDomain(row: TxRow): TransactionRecord {
  return {
    id: row.id,
    userUsername: row.userUsername,
    category: row.category,
    direction: row.direction,
    provider: row.provider,
    status: row.status,
    usdAmountPaid: row.usdAmountPaid.toNumber(),
    cryptoAmountPaid: row.cryptoAmountPaid.toNumber(),
    coinAmountPaid: row.coinAmountPaid.toNumber(),
    balanceAfter: row.balanceAfter.toNumber(),
    assetType: row.assetType,
    assetSymbol: row.assetSymbol ?? null,
    referenceType: row.referenceType,
    referenceId: row.referenceId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt,
  };
}
