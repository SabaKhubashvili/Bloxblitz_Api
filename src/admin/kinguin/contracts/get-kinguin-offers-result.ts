export interface getKinguinOffersResult {
  offers: {
    offerId: string;           // JSON id
    productId: string;         // JSON productId
    name: string;              // JSON name
    status: string;            // JSON status
    sold: number;              // JSON sold
    unitPrice?: number;        // JSON unitPrice
    availableStock?: number;   // JSON availableStock
    buyableStock?: number;     // JSON buyableStock
    createdAt?: string;        // JSON createdAt
    updatedAt?: string;        // JSON updatedAt
    region?: string;           // JSON productDetails.region.name
    platform?: string;         // JSON productDetails.platform.name
    imageUrl?: string;         // JSON productDetails.imageUrl
    merchantType?: string;     // JSON merchantType
    preOrder?: boolean;        // JSON preOrder
  }[];

  totalActive: number;
  totalActiveWithoutStock: number;
  totalInactive: number;
  totalBlock: number | null;
  totalManualVerification: number | null;
  totalPrePurchaseStock: number;
  totalSpaActive: number;
  totalFavorite: number | null;
}
