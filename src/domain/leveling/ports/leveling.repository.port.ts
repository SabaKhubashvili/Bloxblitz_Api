import type { LevelProgress, XpEventRecord } from '../entities/level-progress.entity';

export interface ILevelingRepository {
  /** Returns null when the user has never had XP recorded. */
  findByUsername(username: string): Promise<LevelProgress | null>;

  /** Persists a newly-created LevelProgress aggregate. */
  save(levelProgress: LevelProgress): Promise<void>;

  /** Updates level fields on an existing user record. */
  update(levelProgress: LevelProgress): Promise<void>;

  /** Appends an immutable XP audit event. */
  logXpEvent(event: XpEventRecord): Promise<void>;

  /** Returns the total XP earned since the given timestamp. */
  sumXpSince(username: string, since: Date): Promise<number>;
}
