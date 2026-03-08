import type { RakebackTypeInfo } from '../../../../domain/rakeback/entities/rakeback.entity';

export interface RakebackSnapshot {
  daily: RakebackTypeInfo;
  weekly: RakebackTypeInfo;
  monthly: RakebackTypeInfo;
}

export interface IRakebackCachePort {
  get(username: string): Promise<RakebackSnapshot | null>;
  set(username: string, data: RakebackSnapshot, ttlSeconds?: number): Promise<void>;
  invalidate(username: string): Promise<void>;
  acquireClaimLock(username: string, ttlMs: number): Promise<boolean>;
  releaseClaimLock(username: string): Promise<void>;
}
