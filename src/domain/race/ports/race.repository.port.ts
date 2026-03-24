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
  position: number;
  userId: string;
  username: string;
  profilePicture: string;
  wageredAmount: string;
  updatedAt: Date;
}

export interface RaceParticipantSnapshot {
  userId: string;
  wageredAmount: string;
  updatedAt: Date;
  finalRank: number | null;
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
    userId: string,
    delta: string,
  ): Promise<void>;
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
  createRaceWithRewards(input: CreateRaceInput): Promise<string>;
}
