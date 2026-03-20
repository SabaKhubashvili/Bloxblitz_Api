/**
 * Maps `CaseItem.variant` (subset of { M, N, F, R }) to the correct `pets` value column.
 *
 * - **Line**: `M` → `mvalue_*`, else `N` → `nvalue_*`, else → `rvalue_*` (same priority as Discord formatting).
 * - **Potion**: `F` + `R` → `*_flyride`, `R` only → `*_ride`, `F` only → `*_fly`, neither → `*_nopotion`.
 *
 * Examples: `M+F+R` → `mvalue_flyride`, `M+R` → `mvalue_ride`, `M` → `mvalue_nopotion`,
 * `N+F+R` → `nvalue_flyride`, `F+R` → `rvalue_flyride`, `R` → `rvalue_ride`.
 */
export type PetValueColumnRow = {
  rvalue_nopotion: number;
  rvalue_ride: number;
  rvalue_fly: number;
  rvalue_flyride: number;
  nvalue_nopotion: number;
  nvalue_ride: number;
  nvalue_fly: number;
  nvalue_flyride: number;
  mvalue_nopotion: number;
  mvalue_ride: number;
  mvalue_fly: number;
  mvalue_flyride: number;
};

function lineFromVariants(variants: ReadonlySet<string>): 'mvalue' | 'nvalue' | 'rvalue' {
  if (variants.has('M')) return 'mvalue';
  if (variants.has('N')) return 'nvalue';
  return 'rvalue';
}

function comboFromVariants(
  variants: ReadonlySet<string>,
): 'nopotion' | 'ride' | 'fly' | 'flyride' {
  const hasF = variants.has('F');
  const hasR = variants.has('R');
  if (hasF && hasR) return 'flyride';
  if (hasR) return 'ride';
  if (hasF) return 'fly';
  return 'nopotion';
}

export function resolvePetValueForCaseItemVariants(
  pet: PetValueColumnRow,
  variants: readonly string[],
): number {
  const set = new Set(variants.map((v) => String(v).toUpperCase()));
  const line = lineFromVariants(set);
  const combo = comboFromVariants(set);
  const column = `${line}_${combo}` as keyof PetValueColumnRow;

  const v = pet[column];
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return v;
}
