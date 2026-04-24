import type { CaseItemRecord } from '../../../../domain/game/case/ports/case.repository.port';

export interface CaseVerifyPoolItemDto {
  id: string;
  weight: number;
  sortOrder: number;
  /** Percent of pool (0–100), two decimals. */
  dropPercent: number;
  pet: {
    id: number;
    name: string;
    image: string;
    rarity: string;
    value: number;
  };
  variant: string[];
}

export function buildCaseVerifyPoolItems(
  pool: CaseItemRecord[],
): CaseVerifyPoolItemDto[] {
  const sorted = [...pool].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id.localeCompare(b.id);
  });
  const totalWeight = sorted.reduce((s, i) => s + i.weight, 0);
  if (totalWeight <= 0) return [];

  return sorted.map((item) => ({
    id: item.id,
    weight: item.weight,
    sortOrder: item.sortOrder,
    dropPercent: Math.round((item.weight / totalWeight) * 10000) / 100,
    pet: {
      id: item.pet.id,
      name: item.pet.name,
      image: item.pet.image,
      rarity: item.pet.rarity,
      value: item.pet.value,
    },
    variant: [...item.variant],
  }));
}
