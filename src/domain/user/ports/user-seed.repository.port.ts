import { UserSeed } from '../entities/user-seed.entity';

export interface IUserSeedRepository {
  findByusername(username: string): Promise<UserSeed | null>;

  /**
   * Atomically reserves the next provably-fair nonce (Redis INCR on
   * `user:nonce:{username}`), seeding from PostgreSQL `totalGamesPlayed` when
   * the Redis key is missing — same counter as Mines / Dice / Cases.
   */
  reserveNextNonce(username: string): Promise<number>;

  /**
   * Rolls back the last `reserveNextNonce` when a follow-up operation fails
   * (e.g. DB write after debit). Best-effort; avoids burning nonces on errors.
   */
  rollbackLastNonce(username: string): Promise<void>;

  /**
   * Persists provably-fair game count to PostgreSQL (Redis nonce is already
   * incremented by the game ledger). Keeps DB aligned for rotation / admin.
   */
  incrementTotalGamesPlayed(username: string, delta: number): Promise<void>;
}
