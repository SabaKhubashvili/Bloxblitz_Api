import { UserSeed } from '../entities/user-seed.entity';

export interface IUserSeedRepository {
  findByusername(username: string): Promise<UserSeed | null>;

  /**
   * Persists provably-fair game count to PostgreSQL (Redis nonce is already
   * incremented by the game ledger). Keeps DB aligned for rotation / admin.
   */
  incrementTotalGamesPlayed(username: string, delta: number): Promise<void>;
}
