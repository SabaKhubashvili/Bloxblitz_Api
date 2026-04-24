import type {
  UserBalanceRecord,
  UserPetValueBalanceRecord,
} from '../../../../domain/user/ports/balance.repository.port';

/**
 * Short-lived read cache for the balance HTTP endpoint.
 *
 * This is intentionally separate from the game-engine's live balance key
 * (`user:balance:{username}`).  That key is managed atomically by Lua
 * scripts and has no TTL.  This cache stores a serialized response snapshot
 * with a 30-second TTL so the REST API never hits the database on every
 * poll without racing the game engine.
 */
export interface IBalanceCachePort {
  /**
   * Returns the cached balance snapshot, or null on a cache miss.
   */
  get(username: string): Promise<UserBalanceRecord | null>;

  /**
   * Returns the cached pet value balance snapshot, or null on a cache miss.
   */
  getPetValueBalance(
    username: string,
  ): Promise<UserPetValueBalanceRecord | null>;

  /**
   * Writes a balance snapshot with the given TTL (in seconds).
   */
  set(
    username: string,
    data: UserBalanceRecord,
    ttlSeconds?: number,
  ): Promise<void>;

  /**
   * Deletes the cached entry so the next read goes to the source of truth.
   * Called whenever the balance is modified outside of the game engine
   * (e.g. after a deposit, withdrawal, or rakeback claim).
   */
  invalidate(username: string): Promise<void>;
}
