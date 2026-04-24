import { createHash } from 'node:crypto';
import type { CaseListQueryFilter } from '../../domain/game/case/services/case-list-query.policy';

const SEARCH_MAX = 160;

/** Strip control chars; normalize case for stable keys (matches case-insensitive search). */
export function sanitizeSearchForCacheKey(raw: string): string {
  const t = raw.trim().toLowerCase();
  return t.replace(/[\u0000-\u001F\u007F]/g, '').slice(0, SEARCH_MAX);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundRisk(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Minimal, ordered payload for hashing. Only whitelisted fields; no raw query strings.
 * Equivalent catalog queries (after DTO normalization) produce identical objects.
 */
export function canonicalCaseListFilterForKey(
  f: CaseListQueryFilter,
): Record<string, string | number> {
  const o: Record<string, string | number> = {};

  if (f.category !== undefined) {
    o.category = f.category;
  }
  if (f.minPrice !== undefined) {
    o.minPrice = roundMoney(f.minPrice);
  }
  if (f.maxPrice !== undefined) {
    o.maxPrice = roundMoney(f.maxPrice);
  }
  if (f.riskMin !== undefined) {
    o.riskMin = roundRisk(f.riskMin);
  }
  if (f.riskMax !== undefined) {
    o.riskMax = roundRisk(f.riskMax);
  }
  if (f.sortBy === 'price') {
    o.sortBy = 'price';
    o.order = f.order === 'desc' ? 'desc' : 'asc';
  }
  if (f.search !== undefined && f.search.trim().length > 0) {
    o.search = sanitizeSearchForCacheKey(f.search);
  }

  return o;
}

/** Deterministic JSON (insertion order = alphabetical keys). */
export function stableStringifyCanonical(
  canonical: Record<string, string | number>,
): string {
  const keys = Object.keys(canonical).sort();
  const ordered: Record<string, string | number> = {};
  for (const k of keys) {
    ordered[k] = canonical[k]!;
  }
  return JSON.stringify(ordered);
}

export function sha256HexOfUtf8(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function caseListFilterCacheHash(filters: CaseListQueryFilter): string {
  const canonical = canonicalCaseListFilterForKey(filters);
  return sha256HexOfUtf8(stableStringifyCanonical(canonical));
}
