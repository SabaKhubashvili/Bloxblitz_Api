import type {
  RewardCaseDefinitionDto,
  LastRewardCaseOpenDto,
  XpMilestoneProgressDto,
} from '../reward-case-keys.service';

/**
 * Per-user reward-cases balance state.
 * Cached as a single JSON blob keyed by username.
 */
export interface CachedUserBalanceState {
  readonly keyBalances: Record<string, number>;
  readonly totalXp: number;
  readonly userLevel: number;
  readonly lastCaseOpen: LastRewardCaseOpenDto | null;
  readonly xpMilestoneProgress: Record<string, XpMilestoneProgressDto>;
}

/**
 * Application-layer cache abstraction for the reward-cases feature.
 *
 * Implementations live in the infrastructure layer (Redis adapter).
 * The interface lives here so the use-case / service layer never depends
 * on a concrete cache technology.
 */
export interface IRewardCasesCachePort {
  // ── Shared definitions cache ──────────────────────────────────────────────

  /** Returns the cached definitions catalog, or null on a miss / error. */
  getDefinitions(): Promise<RewardCaseDefinitionDto[] | null>;

  /** Persists the definitions catalog with the given TTL. */
  setDefinitions(
    defs: RewardCaseDefinitionDto[],
    ttlSeconds: number,
  ): Promise<void>;

  /**
   * Drops the definitions catalog from cache.
   * Must be called by any admin operation that mutates case definitions
   * or pool items.
   */
  invalidateDefinitions(): Promise<void>;

  /**
   * Attempt to acquire a short-lived populate-lock (NX semantics).
   * Returns true if the lock was obtained (caller must populate and release).
   * Returns false if another caller is already populating (caller may still
   * fetch from DB but should skip the cache write to avoid a race).
   */
  acquireDefinitionsLock(ttlMs: number): Promise<boolean>;

  /** Release the populate-lock acquired via acquireDefinitionsLock. */
  releaseDefinitionsLock(): Promise<void>;

  // ── Per-user balance state cache ──────────────────────────────────────────

  /** Returns the cached user balance state, or null on a miss / error. */
  getUserState(username: string): Promise<CachedUserBalanceState | null>;

  /** Persists the user balance state with the given TTL. */
  setUserState(
    username: string,
    state: CachedUserBalanceState,
    ttlSeconds: number,
  ): Promise<void>;

  /**
   * Drops the user balance state from cache.
   * Must be called after any mutation that changes this user's key
   * balances, last case open, or XP milestone progress.
   */
  invalidateUserState(username: string): Promise<void>;

  // ── Global 24-hour case cooldown ──────────────────────────────────────────

  /**
   * Returns the Unix-ms timestamp recorded when the user last opened any
   * reward case, or null if no entry exists in cache.
   */
  getCooldownTimestamp(username: string): Promise<number | null>;

  /**
   * Persists the current time as the cooldown timestamp with the given
   * TTL (seconds).
   */
  setCooldown(username: string, ttlSeconds: number): Promise<void>;

  // ── Per-user open-lock (prevents concurrent opens / double-spend) ─────────

  /**
   * Attempt to acquire a short-lived exclusive lock for this user's next
   * case open.  Returns true if the lock was obtained; false if another
   * open is already in-flight.
   */
  acquireOpenLock(username: string, ttlMs: number): Promise<boolean>;

  /** Release the open lock acquired via acquireOpenLock. */
  releaseOpenLock(username: string): Promise<void>;
}
