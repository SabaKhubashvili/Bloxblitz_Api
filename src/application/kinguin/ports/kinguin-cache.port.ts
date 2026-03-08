export interface IKinguinCachePort {
  acquireCodeLock(codeHash: string, ttlMs: number): Promise<boolean>;
  releaseCodeLock(codeHash: string): Promise<void>;
}
