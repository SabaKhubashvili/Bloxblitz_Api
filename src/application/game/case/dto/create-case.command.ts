import type { CaseVariantCreate } from '../../../../domain/game/case/ports/case.repository.port';

export interface CreateCaseItemCommand {
  petId: number;
  weight: number;
  sortOrder: number;
  /** M / N / F / R; omit or [] for regular no-potion (`rvalue_nopotion`). */
  variant?: string[];
}

export interface CreateCaseCommand {
  actorUsername: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  price: number;
  variant: CaseVariantCreate;
  riskLevel: number;
  isActive: boolean;
  sortOrder: number;
  items: CreateCaseItemCommand[];
}
