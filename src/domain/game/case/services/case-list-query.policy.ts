import type { CaseListEntry } from '../ports/case.repository.port';

export type CaseRiskBand = 'low' | 'medium' | 'high' | 'critical';

export type CaseCatalogCategoryFilter = 'amp' | 'mm2';

export interface CaseListQueryFilter {
  minPrice?: number;
  maxPrice?: number;
  riskMin?: CaseRiskBand;
  riskMax?: CaseRiskBand;
  sortBy?: 'price';
  order?: 'asc' | 'desc';
  search?: string;
  category?: CaseCatalogCategoryFilter;
}

const BAND_ORDER: Record<CaseRiskBand, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export function riskLevelToBand(riskLevel: number): CaseRiskBand {
  if (riskLevel <= 10) return 'low';
  if (riskLevel <= 20) return 'medium';
  if (riskLevel <= 30) return 'high';
  return 'critical';
}

function passesRiskFilter(
  riskLevel: number,
  riskMin?: CaseRiskBand,
  riskMax?: CaseRiskBand,
): boolean {
  if (riskMin === undefined && riskMax === undefined) return true;
  const band = riskLevelToBand(riskLevel);
  const b = BAND_ORDER[band];
  const min = riskMin !== undefined ? BAND_ORDER[riskMin] : 0;
  const max = riskMax !== undefined ? BAND_ORDER[riskMax] : BAND_ORDER.critical;
  return b >= min && b <= max;
}

/**
 * Filters and optionally sorts an in-memory case catalog (same shape as list cache / DB rows).
 */
export function filterCaseListEntries(
  entries: CaseListEntry[],
  q: CaseListQueryFilter,
): CaseListEntry[] {
  let out = entries.filter((e) => {
    if (q.minPrice !== undefined && e.price < q.minPrice) return false;
    if (q.maxPrice !== undefined && e.price > q.maxPrice) return false;
    if (!passesRiskFilter(e.riskLevel, q.riskMin, q.riskMax)) return false;
    if (q.category !== undefined && e.catalogCategory !== q.category) return false;
    if (q.search !== undefined && q.search.length > 0) {
      const needle = q.search.toLowerCase();
      if (!e.name.toLowerCase().includes(needle)) return false;
    }
    return true;
  });

  if (q.sortBy === 'price') {
    const dir = q.order === 'desc' ? -1 : 1;
    out = [...out].sort(
      (a, b) => (a.price - b.price) * dir || a.name.localeCompare(b.name),
    );
  }

  return out;
}
