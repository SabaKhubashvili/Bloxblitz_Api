import type { RaceRecord } from './race.repository.port';
import type { RaceLeaderboardEntry } from './race.repository.port';

/** Cached shape for `race:current` (no leaderboard rows). */
export interface CurrentRaceCachePayload {
  race: RaceRecord;
  rewards: Array<{ position: number; rewardAmount: string }>;
}

export interface IRaceCachePort {
  getCurrentRace(): Promise<CurrentRaceCachePayload | null>;
  setCurrentRace(
    payload: CurrentRaceCachePayload,
    ttlSeconds?: number,
  ): Promise<void>;
  deleteCurrentRace(): Promise<void>;

  getTop10(raceId: string): Promise<RaceLeaderboardEntry[] | null>;
  setTop10(
    raceId: string,
    entries: RaceLeaderboardEntry[],
    ttlSeconds?: number,
  ): Promise<void>;
  deleteTop10(raceId: string): Promise<void>;

  getUserRank(raceId: string, userId: string): Promise<number | null>;
  setUserRank(
    raceId: string,
    userId: string,
    rank: number,
    ttlSeconds?: number,
  ): Promise<void>;
  deleteUserRank(raceId: string, userId: string): Promise<void>;

  /** After a wager mutation: drop leaderboard + this user’s rank snapshot. */
  invalidateAfterWager(raceId: string, userId: string): Promise<void>;

  /** After a race completes: clear current race + that race’s hot keys. */
  invalidateAfterFinish(raceId: string): Promise<void>;
}
