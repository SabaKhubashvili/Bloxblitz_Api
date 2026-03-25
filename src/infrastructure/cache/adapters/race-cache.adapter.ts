import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RedisArgument } from 'redis';
import { RedisService } from '../redis.service';
import { RedisKeys } from '../redis.keys';
import type {
  IRaceCachePort,
  CurrentRaceCachePayload,
} from '../../../domain/race/ports/race-cache.port';
import type {
  RaceLeaderboardEntry,
  RaceParticipantAfterIncrement,
  RaceRecord,
} from '../../../domain/race/ports/race.repository.port';
import { RaceStatus } from '../../../domain/race/enums/race-status.enum';
import { RACE_CACHE_TTL } from '../../../application/race/tokens/race.tokens';

type SerializedCurrentRace = {
  race: Omit<RaceRecord, 'startTime' | 'endTime'> & {
    startTime: string;
    endTime: string;
  };
  rewards: Array<{ position: number; rewardAmount: string }>;
};

function compareLeaderboardRows(
  a: RaceLeaderboardEntry,
  b: RaceLeaderboardEntry,
): number {
  const wa = new Prisma.Decimal(a.wageredAmount);
  const wb = new Prisma.Decimal(b.wageredAmount);
  const cmp = wb.cmp(wa);
  if (cmp !== 0) return cmp;
  return a.updatedAt.getTime() - b.updatedAt.getTime();
}

@Injectable()
export class RaceCacheAdapter implements IRaceCachePort {
  private readonly logger = new Logger(RaceCacheAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async getCurrentRace(): Promise<CurrentRaceCachePayload | null> {
    try {
      const raw = await this.redis.get<SerializedCurrentRace>(
        RedisKeys.race.current(),
      );
      if (!raw?.race) return null;
      return {
        race: {
          id: raw.race.id,
          status: raw.race.status as RaceStatus,
          totalPrizePool: raw.race.totalPrizePool,
          startTime: new Date(raw.race.startTime),
          endTime: new Date(raw.race.endTime),
        },
        rewards: raw.rewards,
      };
    } catch (e) {
      this.logger.warn('[RaceCache] getCurrentRace failed', e);
      return null;
    }
  }

  async setCurrentRace(
    payload: CurrentRaceCachePayload,
    ttlSeconds: number = RACE_CACHE_TTL.currentSec,
  ): Promise<void> {
    try {
      const serializable: SerializedCurrentRace = {
        race: {
          id: payload.race.id,
          status: payload.race.status,
          totalPrizePool: payload.race.totalPrizePool,
          startTime: payload.race.startTime.toISOString(),
          endTime: payload.race.endTime.toISOString(),
        },
        rewards: payload.rewards,
      };
      await this.redis.set(
        RedisKeys.race.current(),
        serializable,
        ttlSeconds,
      );
    } catch (e) {
      this.logger.warn('[RaceCache] setCurrentRace failed', e);
    }
  }

  async deleteCurrentRace(): Promise<void> {
    try {
      await this.redis.del(RedisKeys.race.current());
    } catch (e) {
      this.logger.warn('[RaceCache] deleteCurrentRace failed', e);
    }
  }

  async getTop10(raceId: string): Promise<RaceLeaderboardEntry[] | null> {
    try {
      const key = RedisKeys.race.top10(raceId);
      const exists = await this.redis.exists(key);
      if (!exists) return null;
      const rows = await this.redis.get<RaceLeaderboardEntry[]>(key);
      if (!rows) return null;
      return rows.map((r) => ({
        ...r,
        updatedAt: new Date(r.updatedAt as unknown as string),
      }));
    } catch (e) {
      this.logger.warn(`[RaceCache] getTop10 failed raceId=${raceId}`, e);
      return null;
    }
  }

  async setTop10(
    raceId: string,
    entries: RaceLeaderboardEntry[],
    ttlSeconds: number = RACE_CACHE_TTL.top10Sec,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.race.top10(raceId),
        entries,
        ttlSeconds,
      );
    } catch (e) {
      this.logger.warn(`[RaceCache] setTop10 failed raceId=${raceId}`, e);
    }
  }

  async deleteTop10(raceId: string): Promise<void> {
    try {
      await this.redis.del(RedisKeys.race.top10(raceId));
    } catch (e) {
      this.logger.warn(`[RaceCache] deleteTop10 failed raceId=${raceId}`, e);
    }
  }

  async getUserRank(raceId: string, userId: string): Promise<number | null> {
    try {
      const v = await this.redis.get<number | string>(
        RedisKeys.race.userRank(raceId, userId),
      );
      if (v === null || v === undefined) return null;
      return typeof v === 'number' ? v : parseInt(String(v), 10);
    } catch (e) {
      this.logger.warn('[RaceCache] getUserRank failed', e);
      return null;
    }
  }

  async setUserRank(
    raceId: string,
    userId: string,
    rank: number,
    ttlSeconds: number = RACE_CACHE_TTL.userRankSec,
  ): Promise<void> {
    try {
      await this.redis.set(
        RedisKeys.race.userRank(raceId, userId),
        rank,
        ttlSeconds,
      );
    } catch (e) {
      this.logger.warn('[RaceCache] setUserRank failed', e);
    }
  }

  async deleteUserRank(raceId: string, userId: string): Promise<void> {
    try {
      await this.redis.del(RedisKeys.race.userRank(raceId, userId));
    } catch (e) {
      this.logger.warn('[RaceCache] deleteUserRank failed', e);
    }
  }

  async refreshAfterWager(
    raceId: string,
    userUsername: string,
    participant: RaceParticipantAfterIncrement,
  ): Promise<void> {
    await this.deleteUserRank(raceId, userUsername);
    try {
      const cached = await this.getTop10(raceId);
      if (cached === null) return;
      const merged = this.mergeTop10WithParticipant(cached, participant);
      await this.setTop10(raceId, merged, RACE_CACHE_TTL.top10Sec);
    } catch (e) {
      this.logger.warn(
        `[RaceCache] refreshAfterWager merge failed raceId=${raceId}`,
        e,
      );
    }
  }

  private mergeTop10WithParticipant(
    current: RaceLeaderboardEntry[],
    p: RaceParticipantAfterIncrement,
  ): RaceLeaderboardEntry[] {
    const byUser = new Map<string, RaceLeaderboardEntry>();
    for (const row of current) {
      byUser.set(row.username, {
        userId: row.userId,
        position: row.position,
        username: row.username,
        profilePicture: row.profilePicture,
        wageredAmount: row.wageredAmount,
        updatedAt: row.updatedAt,
      });
    }
    byUser.set(p.username, {
      userId: p.userId,
      position: 0,
      username: p.username,
      profilePicture: p.profilePicture,
      wageredAmount: p.wageredAmount,
      updatedAt: p.updatedAt,
    });
    const sorted = [...byUser.values()].sort(compareLeaderboardRows).slice(0, 10);
    return sorted.map((r, i) => ({ ...r, position: i + 1 }));
  }

  async invalidateAfterFinish(raceId: string): Promise<void> {
    await this.deleteCurrentRace();
    await this.deleteTop10(raceId);
    const pattern = `race:${raceId}:rank:*`;
    let cursor: RedisArgument = '0';
    try {
      for (let i = 0; i < 50; i += 1) {
        const { cursor: next, keys } = await this.redis.scan(
          cursor,
          pattern,
          200,
        );
        for (const k of keys) {
          await this.redis.del(k);
        }
        if (String(next) === '0') break;
        cursor = next;
      }
    } catch (e) {
      this.logger.warn('[RaceCache] invalidateAfterFinish scan failed', e);
    }
  }
}
