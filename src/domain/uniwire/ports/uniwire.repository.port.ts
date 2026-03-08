/**
 * Database record shapes for Uniwire persistence.
 * Implementations live in the infrastructure layer (e.g. PrismaUniwireRepository).
 */

export interface UniwireUserProfileRecord {
  readonly id: string;
  readonly username: string;
  readonly profileId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

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
  readonly id: string;
  readonly username: string;
  readonly invoiceId: string;
  readonly profileId: string;
  readonly currency: string;
  readonly kind: string;
  readonly address: string | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Persistent-storage contract for Uniwire-related data.
 * Implementations live in the infrastructure layer.
 */
export interface IUniwireRepository {
  /** Find Uniwire profile linked to a user. */
  findProfileByUsername(username: string): Promise<UniwireUserProfileRecord | null>;

  /** Link a user to a Uniwire profile. */
  upsertUserProfile(username: string, profileId: string): Promise<UniwireUserProfileRecord>;

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
