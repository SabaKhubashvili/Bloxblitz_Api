import type { RaceStatus } from '../enums/race-status.enum';

export interface RaceRecord {
  id: string;
  startTime: Date;
  endTime: Date;
  status: RaceStatus;
  totalPrizePool: string | null;
}

export interface RaceRewardRecord {
  raceId: string;
  position: number;
  rewardAmount: string;
}

export interface RaceLeaderboardEntry {
  /** Database user id (UUID). Omitted on legacy cached leaderboard rows until refresh. */
  userId?: string;
  position: number;
  username: string;
  profilePicture: string;
  wageredAmount: string;
  updatedAt: Date;
}

export interface RaceParticipantSnapshot {
  username: string;
  wageredAmount: string;
  updatedAt: Date;
  finalRank: number | null;
}

/** Row returned after incrementing wager (for cache merge). */
export interface RaceParticipantAfterIncrement {
  userId: string;
  username: string;
  profilePicture: string;
  wageredAmount: string;
  updatedAt: Date;
}

export interface CreateRaceRewardInput {
  position: number;
  rewardAmount: string;
}

export interface CreateRaceInput {
  startTime: Date;
  endTime: Date;
  rewards: CreateRaceRewardInput[];
}

export interface IRaceRepository {
  findActiveRace(): Promise<RaceRecord | null>;
  findRaceById(id: string): Promise<RaceRecord | null>;
  findRewardsByRaceId(raceId: string): Promise<RaceRewardRecord[]>;
  findRewardsByRaceIds(
    raceIds: string[],
  ): Promise<Map<string, RaceRewardRecord[]>>;
  findLeaderboardTop(
    raceId: string,
    limit: number,
  ): Promise<RaceLeaderboardEntry[]>;
  findLeaderboardTopForRaces(
    raceIds: string[],
    limit: number,
  ): Promise<Map<string, RaceLeaderboardEntry[]>>;
  incrementWager(
    raceId: string,
    userUsername: string,
    delta: string,
  ): Promise<RaceParticipantAfterIncrement>;
  getParticipant(
    raceId: string,
    userId: string,
  ): Promise<RaceParticipantSnapshot | null>;
  countParticipantsAhead(
    raceId: string,
    wageredAmount: string,
    updatedAt: Date,
  ): Promise<number>;
  finishRace(raceId: string): Promise<void>;
  listFinishedRaces(
    offset: number,
    limit: number,
  ): Promise<RaceRecord[]>;
  /** Any race whose interval overlaps [startTime, endTime] (touching endpoints do not count as overlap). */
  findRaceOverlappingTimeRange(
    startTime: Date,
    endTime: Date,
  ): Promise<RaceRecord | null>;
  createRaceWithRewards(input: CreateRaceInput): Promise<string>;
}
