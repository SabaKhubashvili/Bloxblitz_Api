export interface KinguinBatchRecord {
  id: string;
  batchName: string;
  purchaseDate: Date;
  totalCodes: number;
  totalValue: number;
  codesRedeemed: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IKinguinBatchRepository {
  create(data: {
    batchName: string;
    purchaseDate: Date;
    totalCodes: number;
    totalValue: number;
    notes?: string;
  }): Promise<KinguinBatchRecord>;
  findMany(): Promise<KinguinBatchRecord[]>;
}
