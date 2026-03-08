export interface DailySpinStatusCacheEntry {
  readonly canSpin: boolean;
  readonly nextSpinAt: string | null; // ISO string — JSON-safe
  readonly currentTier: number;
}

export interface IDailySpinCachePort {
  getStatus(username: string): Promise<DailySpinStatusCacheEntry | null>;
  setStatus(
    username: string,
    entry: DailySpinStatusCacheEntry,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidate(username: string): Promise<void>;

  /** Returns true if lock was acquired (NX semantics). */
  acquireSpinLock(username: string, ttlMs: number): Promise<boolean>;
  releaseSpinLock(username: string): Promise<void>;
}
