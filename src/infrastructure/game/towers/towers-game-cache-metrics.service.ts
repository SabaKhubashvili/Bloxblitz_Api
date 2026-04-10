import { Injectable } from '@nestjs/common';

/**
 * Lightweight in-process counters for Towers Redis cache observability.
 * Logs can be aggregated externally; values reset on process restart.
 */
@Injectable()
export class TowersGameCacheMetricsService {
  cacheHits = 0;
  cacheMisses = 0;
  redisRepairs = 0;
  redisErrors = 0;
  persistSuccess = 0;
  persistFailures = 0;
  dlqPushes = 0;

  /** Last observed latencies (ms) for recent operations (rolling, max 200 samples). */
  private readonly latencyHitMs: number[] = [];

  recordHit(latencyMs: number): void {
    this.cacheHits++;
    this.pushLatency(latencyMs);
  }

  recordMiss(): void {
    this.cacheMisses++;
  }

  recordRepair(): void {
    this.redisRepairs++;
  }

  recordRedisError(): void {
    this.redisErrors++;
  }

  recordPersistOk(): void {
    this.persistSuccess++;
  }

  recordPersistFail(): void {
    this.persistFailures++;
  }

  recordDlq(): void {
    this.dlqPushes++;
  }

  snapshot(): {
    cacheHits: number;
    cacheMisses: number;
    redisRepairs: number;
    redisErrors: number;
    persistSuccess: number;
    persistFailures: number;
    dlqPushes: number;
    approxHitRate: number;
    latencyHitP50Ms: number | null;
    latencyHitP95Ms: number | null;
  } {
    const total = this.cacheHits + this.cacheMisses;
    const sorted = [...this.latencyHitMs].sort((a, b) => a - b);
    const p = (q: number) =>
      sorted.length === 0
        ? null
        : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!;
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      redisRepairs: this.redisRepairs,
      redisErrors: this.redisErrors,
      persistSuccess: this.persistSuccess,
      persistFailures: this.persistFailures,
      dlqPushes: this.dlqPushes,
      approxHitRate: total === 0 ? 0 : this.cacheHits / total,
      latencyHitP50Ms: p(0.5),
      latencyHitP95Ms: p(0.95),
    };
  }

  private pushLatency(ms: number): void {
    this.latencyHitMs.push(ms);
    if (this.latencyHitMs.length > 200) {
      this.latencyHitMs.splice(0, this.latencyHitMs.length - 200);
    }
  }
}
