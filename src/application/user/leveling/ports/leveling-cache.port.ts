import type { LevelProgress } from '../../../../domain/leveling/entities/level-progress.entity';

export interface ILevelingCachePort {
  getUserLevel(username: string): Promise<LevelProgress | null>;
  setUserLevel(
    username: string,
    levelProgress: LevelProgress,
    ttlSeconds?: number,
  ): Promise<void>;
  invalidateUserLevel(username: string): Promise<void>;
}
