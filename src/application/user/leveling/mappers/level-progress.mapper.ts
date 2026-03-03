import { LevelProgress } from '../../../../domain/leveling/entities/level-progress.entity.js';
import { LevelVO } from '../../../../domain/leveling/value-objects/level.vo.js';
import { XpAmount } from '../../../../domain/leveling/value-objects/xp-amount.vo.js';
import type { LevelProgressOutputDto } from '../dto/level-progress.output-dto.js';
import type { TierInfoOutputDto } from '../dto/tier-info.output-dto.js';

export interface RawLevelRecord {
  username:     string;
  totalXP:      number;
  currentLevel: number;
  xpMultiplier: number;
}

/** Serialised form stored in Redis. */
export interface CachedLevelData {
  username:     string;
  totalXp:      number;
  currentLevel: number;
  xpMultiplier: number;
}

export class LevelProgressMapper {
  /** Maps a raw DB/cache record to a domain aggregate. */
  static toDomain(raw: RawLevelRecord): LevelProgress {
    return LevelProgress.reconstitute({
      username:     raw.username,
      totalXp:      XpAmount.of(raw.totalXP),
      currentLevel: LevelVO.create(raw.currentLevel),
      xpMultiplier: Number(raw.xpMultiplier),
    });
  }

  /** Converts a domain aggregate to the HTTP output DTO. */
  static toOutputDto(
    lp: LevelProgress,
    extras: { xpEarnedLast24h: number; rakebackPercent: number } = { xpEarnedLast24h: 0, rakebackPercent: 0 },
  ): LevelProgressOutputDto {
    const { currentLevelXp, nextLevelXp, progress } = lp.getXpProgress();
    return {
      username:        lp.username,
      currentLevel:    lp.currentLevel,
      totalXp:         lp.totalXp,
      tierNumber:      lp.tierNumber,
      tierName:        lp.tierName,
      xpMultiplier:    lp.xpMultiplier,
      xpProgress: {
        currentLevelXp,
        nextLevelXp,
        progressPercent: Math.round(progress * 100),
      },
      xpEarnedLast24h:  extras.xpEarnedLast24h,
      rakebackPercent:   (extras.rakebackPercent).toFixed(2),
    };
  }

  /** Converts a domain aggregate to a plain object safe for Redis storage. */
  static toCachePayload(lp: LevelProgress): CachedLevelData {
    return {
      username:     lp.username,
      totalXp:      lp.totalXp,
      currentLevel: lp.currentLevel,
      xpMultiplier: lp.xpMultiplier,
    };
  }

  /** Reconstitutes a domain aggregate from a cached plain object. */
  static fromCachePayload(data: CachedLevelData): LevelProgress {
    return LevelProgress.reconstitute({
      username:     data.username,
      totalXp:      XpAmount.of(data.totalXp),
      currentLevel: LevelVO.create(data.currentLevel),
      xpMultiplier: data.xpMultiplier,
    });
  }

  /** Maps a LevelVO to the tier-info output DTO. */
  static toTierInfoDto(level: number, tierNumber: number, tierName: string): TierInfoOutputDto {
    return { level, tierNumber, tierName };
  }
}
