
export interface CasePetSnapshot {
  id: number;
  name: string;
  image: string;
  rarity: string;
  /** Resolved from `pets` using `CaseItem.variant` (m/n/r line × potion combo). */
  value: number;
}

export interface CaseItemRecord {
  id: string;
  petId: number;
  weight: number;
  sortOrder: number;
  /** Subset of M, N, F, R — drives which `pets.*value_*` column applies. */
  variant: string[];
  pet: CasePetSnapshot;
}

export interface CaseListEntry {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  variant: string;
  riskLevel: number;
  isActive: boolean;
  sortOrder: number;
}

export interface CaseDetailRecord extends CaseListEntry {
  items: CaseItemRecord[];
}

/** Case row fields for SEO / page metadata (no item join when loaded alone). */
export interface CaseMetadataRecord {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  variant: string;
  riskLevel: number;
  isActive: boolean;
  itemCount: number;
}

export interface CaseOpenWrite {
  id: string;
  gameHistoryId: string;
  username: string;
  caseId: string;
  wonCaseItemId: string;
  openBatchIndex: number;
  pricePaid: number;
  /** Pet value won (same currency as case price / user balance). */
  wonPetValue: number;
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;
  normalizedRoll: number;
}

/** Matches Prisma `CaseVariant` enum values. */
export type CaseVariantCreate = 'FEATURED' | 'STANDARD' | 'HIGH_RISK';

export interface CreateCaseItemInput {
  petId: number;
  weight: number;
  sortOrder: number;
  /** Prisma `Variant[]`; empty → regular no-potion column (`rvalue_nopotion`). */
  variant?: string[];
}

export interface CreateCaseWithItemsInput {
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  variant: CaseVariantCreate;
  riskLevel: number;
  isActive: boolean;
  sortOrder: number;
  items: CreateCaseItemInput[];
}

export interface ICaseRepository {
  findAllActive(): Promise<CaseListEntry[]>;
  /** Includes inactive cases; caller decides NotFound vs inactive. */
  findBySlugWithItems(slug: string): Promise<CaseDetailRecord | null>;
  /** Lightweight case row + item count for public metadata (no pets/items payload). */
  findBySlugMetadata(slug: string): Promise<CaseMetadataRecord | null>;
  saveOpens(opens: CaseOpenWrite[]): Promise<void>;
  createWithItems(input: CreateCaseWithItemsInput): Promise<{ id: string }>;
}
