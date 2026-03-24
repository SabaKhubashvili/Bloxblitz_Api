export type CaseCatalogCategoryFilter = 'amp' | 'mm2';

export interface CaseListQueryFilter {
  minPrice?: number;
  maxPrice?: number;
  /** Inclusive lower bound on `Case.riskLevel` (0–100). */
  riskMin?: number;
  /** Inclusive upper bound on `Case.riskLevel` (0–100). */
  riskMax?: number;
  sortBy?: 'price';
  order?: 'asc' | 'desc';
  search?: string;
  category?: CaseCatalogCategoryFilter;
}

/** When true, the public list may be served from the unfiltered Redis cache. */
export function isCaseListQueryUnfiltered(q: CaseListQueryFilter): boolean {
  return (
    q.minPrice === undefined &&
    q.maxPrice === undefined &&
    q.riskMin === undefined &&
    q.riskMax === undefined &&
    q.sortBy === undefined &&
    (q.search === undefined || q.search.length === 0) &&
    q.category === undefined
  );
}
