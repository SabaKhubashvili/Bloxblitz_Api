import type {
  RaceLeaderboardEntry,
  RaceParticipantAfterIncrement,
  RaceRecord,
} from './race.repository.port';

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

  /**
   * After a credited race wager: clear this user’s rank snapshot and merge
   * their new totals into cached top-10 when present (avoids nuking `race:current`).
   */
  refreshAfterWager(
    raceId: string,
    userUsername: string,
    participant: RaceParticipantAfterIncrement,
  ): Promise<void>;

  /** After a race completes: clear current race + that race’s hot keys. */
  invalidateAfterFinish(raceId: string): Promise<void>;
}
