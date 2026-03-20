import type { CaseDetailRecord } from './case.repository.port';

export interface ICaseDetailCachePort {
  get(slug: string): Promise<CaseDetailRecord | null>;
  set(slug: string, record: CaseDetailRecord, ttlSeconds: number): Promise<void>;
}
