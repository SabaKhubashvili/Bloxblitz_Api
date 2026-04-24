import { Injectable } from '@nestjs/common';
import type {
  IUniwireRepository,
  UniwirePayoutRecord,
  UniwireInvoiceRecord,
  UniwireTransactionRecord,
} from '../../../../domain/uniwire/ports/uniwire.repository.port';
import {
  AssetType,
  AvailableCryptos,
  CryptoTransaction,
  PaymentProviders,
  ReferenceType,
  TransactionCategory,
  TransactionDirection,
  TransactionStatus,
  UserDepositAddress,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { getUniwireInvoiceKind } from 'src/domain/uniwire/services/uniwire-helpers.service';
import { UniwireRecentTransaction } from 'src/domain/uniwire/entities/uniwire.entity';

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

function toRecentTransactionsDomain(
  prisma: CryptoTransaction,
): UniwireRecentTransaction {
  return {
    coinAmountPaid: prisma.coinAmountPaid.toNumber(),
    cryptoAmountPaid: prisma.cryptoAmountPaid.toNumber(),
    confirmations: prisma.confirmations,
    minConfirmations: prisma.minConfirmations,
    isFullyConfirmed: prisma.isFullyConfirmed,
    txid: prisma.txid,
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
  async findInvoiceByUsernameAndCurrency(
    username: string,
    currency: string,
  ): Promise<UniwireInvoiceRecord | null> {
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

  async getRecentTransactions(
    username: string,
    currency: AvailableCryptos,
  ): Promise<UniwireRecentTransaction[]> {
    const record = await this.prisma.cryptoTransaction.findMany({
      where: {
        username: username,
        currency: currency,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    return record.map(toRecentTransactionsDomain);
  }

  async createPayout(
    _data: Omit<UniwirePayoutRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      balanceAfter: number;
    },
  ): Promise<UniwirePayoutRecord> {
    const record = await this.prisma.transactionHistory.create({
      data: {
        userUsername: _data.username,
        category: TransactionCategory.CRYPTO,
        direction: TransactionDirection.OUT,
        provider: PaymentProviders.UNIWIRE,
        status: TransactionStatus.PENDING,
        usdAmountPaid: _data.amount,
        cryptoAmountPaid: _data.amount,
        coinAmountPaid: _data.amount,
        assetType: AssetType.CRYPTO,
        referenceType: ReferenceType.CRYPTO_TRANSACTION,
        referenceId: _data.payoutId,
        balanceAfter: _data.balanceAfter,
      },
    });
    return {
      id: record.id,
      username: record.userUsername,
      payoutId: record.referenceId,
      amount: record.coinAmountPaid.toNumber(),
      currency: _data.currency,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: new Date(),
    };
  }

  async findPayoutByPayoutId(
    _payoutId: string,
  ): Promise<UniwirePayoutRecord | null> {
    throw new Error(
      'Uniwire repository not implemented: add UniwirePayout table and implement findPayoutByPayoutId',
    );
  }

  async createInvoice(
    data: Omit<UniwireInvoiceRecord, 'createdAt' | 'updatedAt'>,
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

  async createInvoiceTransactionPending(
    data: Omit<UniwireTransactionRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void> {
    await this.prisma.cryptoTransaction.create({
      data: {
        invoiceId: data.invoiceId,
        status: TransactionStatus.PENDING,
        providerTransactionId: data.providerTransactionId,
        txid: data.txid,
        currency: data.currency,
        network: data.network,
        usdAmountPaid: data.usdAmountPaid,
        cryptoAmountPaid: data.cryptoAmountPaid,
        coinAmountPaid: data.coinAmountPaid,
      },
    });
  }
  async updateInvoiceTransactionConfirmed(
    data: Omit<UniwireTransactionRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      balanceAfter: number;
    },
  ): Promise<void> {
    await this.prisma.cryptoTransaction.update({
      where: {
        invoiceId: data.invoiceId,
        providerTransactionId: data.providerTransactionId,
      },
      data: {
        status: TransactionStatus.COMPLETED,
        confirmedAt: new Date(),
        confirmations: data.confirmations,
        isFullyConfirmed: data.isFullyConfirmed,
      },
    });
    await this.prisma.transactionHistory.create({
      data: {
        userUsername: data.username,
        category: TransactionCategory.CRYPTO,
        direction: TransactionDirection.IN,
        provider: PaymentProviders.UNIWIRE,
        status: TransactionStatus.COMPLETED,
        usdAmountPaid: data.usdAmountPaid,
        cryptoAmountPaid: data.cryptoAmountPaid,
        balanceAfter: data.balanceAfter,
        referenceType: ReferenceType.CRYPTO_TRANSACTION,
        referenceId: data.invoiceId,
        coinAmountPaid: data.coinAmountPaid,
        assetType: AssetType.CRYPTO,
      },
    });
  }

  async findInvoiceByInvoiceId(
    _invoiceId: string,
  ): Promise<UniwireInvoiceRecord | null> {
    throw new Error(
      'Uniwire repository not implemented: add UniwireInvoice table and implement findInvoiceByInvoiceId',
    );
  }

  async updateInvoiceStatus(
    _invoiceId: string,
    _status: string,
  ): Promise<void> {
    throw new Error(
      'Uniwire repository not implemented: implement updateInvoiceStatus',
    );
  }
}
