export interface KinguinCodeRecord {
  id: string;
  code: string;
  value: number;
  status: string;
  isRedeemed: boolean;
  redeemedBy: string | null;
  redeemedAt: Date | null;
  expiresAt: Date | null;
  batchId: string | null;
  createdAt: Date;
}

export interface RedeemCodeData {
  username: string;
  ipAddress?: string;
  userAgent?: string;
  creditsBefore: number;
  creditsAfter: number;
  creditAmount: number;
}

export interface IKinguinCodeRepository {
  findByCode(codeHash: string): Promise<KinguinCodeRecord | null>;
  redeemCode(id: string, batchId: string | null, data: RedeemCodeData): Promise<void>;
  disableCode(codeHash: string): Promise<boolean>;
  createMany(codes: Array<{ code: string; value: number; expiresAt?: Date; batchId: string }>): Promise<void>;
  findByBatch(params: {
    batchId: string;
    page: number;
    limit: number;
    status?: string;
  }): Promise<{ items: KinguinCodeRecord[]; total: number }>;
  countByStatus(): Promise<Record<string, number>>;
}
