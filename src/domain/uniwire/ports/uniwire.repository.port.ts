import {
  AvailableCryptos,
  CryptoTransaction,
  TransactionStatus,
} from '@prisma/client';
import { UniwireInvoiceKind } from './uniwire-api.ports';
import { UniwireRecentTransaction } from '../entities/uniwire.entity';

/**
 * Database record shapes for Uniwire persistence.
 * Implementations live in the infrastructure layer (e.g. PrismaUniwireRepository).
 */

export interface UniwirePayoutRecord {
  readonly id: string;
  readonly username: string;
  readonly payoutId: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UniwireInvoiceRecord {
  readonly userUsername: string;
  readonly currency: AvailableCryptos;
  readonly kind: UniwireInvoiceKind;
  readonly address: string;
  readonly profileId: string;
  readonly invoiceId: string | null;
  readonly lastUsedAt: Date | null;
}

/**
 * Persistent-storage contract for Uniwire-related data.
 * Implementations live in the infrastructure layer.
 */
export interface IUniwireRepository {
  /** Create a payout record. */
  createPayout(
    data: Omit<UniwirePayoutRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      balanceAfter: number;
    },
  ): Promise<UniwirePayoutRecord>;

  /** Find Uniwire profile linked to a user. */
  findInvoiceByUsernameAndCurrency(
    username: string,
    currency: string,
  ): Promise<UniwireInvoiceRecord | null>;

  /** Get recent transactions for a user and currency. */
  getRecentTransactions(
    username: string,
    currency: AvailableCryptos,
    limit?: number,
  ): Promise<UniwireRecentTransaction[]>;

  /** Save an invoice record. */
  createInvoice(
    data: Omit<UniwireInvoiceRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<UniwireInvoiceRecord>;

  /** Create a transaction record for a pending invoice. */
  createInvoiceTransactionPending(
    data: Omit<UniwireTransactionRecord, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<void>;

  /** Create a transaction record for a confirmed invoice. */
  updateInvoiceTransactionConfirmed(
    data: Omit<UniwireTransactionRecord, 'id' | 'createdAt' | 'updatedAt'> & {
      balanceAfter: number;
    },
  ): Promise<void>;
}

export interface UniwireTransactionRecord {
  readonly id: string;
  readonly invoiceId: string;
  readonly status: TransactionStatus;
  readonly providerTransactionId: string;
  readonly txid: string;
  readonly currency: AvailableCryptos;
  readonly network: string;
  readonly usdAmountPaid: number;
  readonly cryptoAmountPaid: number;
  readonly coinAmountPaid: number;
  readonly username: string;
  readonly minConfirmations: number;
  readonly confirmations?: number;
  readonly isFullyConfirmed?: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
