import type { CaseListEntry } from './case.repository.port';

export interface ICaseListCachePort {
  get(): Promise<CaseListEntry[] | null>;
  set(entries: CaseListEntry[], ttlSeconds: number): Promise<void>;
  invalidate(): Promise<void>;
}
