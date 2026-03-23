import { Variant } from "@prisma/client";

export interface CasePetOutputDto {
  id: number;
  name: string;
  image: string;
  rarity: string;
  /** Pet value credited on case win (from `pets` column chosen by item `variant`). */
  value: number;
  variant: string[];
}

export interface CaseItemOutputDto {
  id: string;
  petId: number;
  weight: number;
  sortOrder: number;
  /** M / N / F / R flags for this pool row (drives value column). */
  variant: string[];
  pet: CasePetOutputDto;
}

export interface CaseSummaryOutputDto {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  variant: string;
  /** AMP vs MM2 (`CaseCatalogCategory`). */
  category: 'amp' | 'mm2';
  riskLevel: number;
  sortOrder: number;
}

export interface CaseDetailOutputDto extends CaseSummaryOutputDto {
  isActive: boolean;
  items: CaseItemOutputDto[];
}

export interface CaseOpenSingleOutputDto {
  openId: string;
  gameHistoryId: string;
  openBatchIndex: number;
  wonCaseItemId: string;
  pricePaid: number;
  normalizedRoll: number;
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;
  pet: CasePetOutputDto;
}

export interface OpenCaseOutputDto {
  case: Pick<CaseSummaryOutputDto, 'id' | 'slug' | 'name'>;
  opens: CaseOpenSingleOutputDto[];
}
