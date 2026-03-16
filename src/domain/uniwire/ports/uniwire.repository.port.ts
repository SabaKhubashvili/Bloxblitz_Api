import { AvailableCryptos } from "@prisma/client";
import { UniwireInvoiceKind } from "./uniwire-api.ports";

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
  /** Find Uniwire profile linked to a user. */
  findInvoiceByUsernameAndCurrency(username: string, currency: string): Promise<UniwireInvoiceRecord | null>;

  /** Save a payout record. */
  createPayout(data: Omit<UniwirePayoutRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<UniwirePayoutRecord>;

  /** Find payout by Uniwire payout id. */
  findPayoutByPayoutId(payoutId: string): Promise<UniwirePayoutRecord | null>;

  /** Save an invoice record. */
  createInvoice(data: Omit<UniwireInvoiceRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<UniwireInvoiceRecord>;

  /** Find invoice by Uniwire invoice id. */
  findInvoiceByInvoiceId(invoiceId: string): Promise<UniwireInvoiceRecord | null>;

  /** Update invoice status (e.g. when deposit is confirmed). */
  updateInvoiceStatus(invoiceId: string, status: string): Promise<void>;
}
