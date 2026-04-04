/** TTL for the shared definitions catalog (all active cases + pool items). */
export const REWARD_CASES_DEFINITIONS_TTL_SECONDS = 120;

/**
 * TTL for the per-user balance state (key balances, XP, level,
 * last case open, XP milestone progress).
 *
 * Kept short because XP / level changes originate in the leveling module
 * and are not explicitly invalidated here.  Actual key-balance changes ARE
 * invalidated eagerly, so this TTL is only a safety-net for XP/level drift.
 */
export const REWARD_CASES_USER_STATE_TTL_SECONDS = 30;

/**
 * TTL for the definitions populate-lock.
 * Prevents a thundering-herd of concurrent DB reads on a cold cache entry.
 * If the holder crashes, the lock expires after this many milliseconds.
 */
export const REWARD_CASES_DEFINITIONS_LOCK_TTL_MS = 5_000;
