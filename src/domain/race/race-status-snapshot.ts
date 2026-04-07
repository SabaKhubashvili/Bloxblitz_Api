import { RaceStatus } from './enums/race-status.enum';
import type { RaceRecord } from './ports/race.repository.port';

export type RaceRewardAmountRow = { rewardAmount: string };

/** Persisted in Redis for `race:public:status` — includes fields to re-validate TTL skew without hitting the DB. */
export type RaceStatusCacheRecord = {
  isActive: boolean;
  totalPrizePool: number;
  startTime: string;
  endTime: string;
  status: RaceStatus;
};

function sumRewardAmounts(rewards: RaceRewardAmountRow[]): number {
  let sum = 0;
  for (const r of rewards) {
    const n = Number.parseFloat(r.rewardAmount);
    if (Number.isFinite(n)) sum += n;
  }
  return Math.round(sum);
}

function poolFromRace(
  race: RaceRecord,
  rewards: RaceRewardAmountRow[],
): number {
  if (race.totalPrizePool != null && race.totalPrizePool !== '') {
    const p = Number.parseFloat(race.totalPrizePool);
    if (Number.isFinite(p) && p > 0) return Math.round(p);
  }
  return sumRewardAmounts(rewards);
}

export function buildRaceStatusCacheRecord(
  race: RaceRecord,
  rewards: RaceRewardAmountRow[],
  now: Date = new Date(),
): RaceStatusCacheRecord {
  const windowOk = race.startTime <= now && now < race.endTime;
  const statusOk =
    race.status === RaceStatus.ACTIVE || race.status === RaceStatus.PAUSED;
  const isActive = Boolean(windowOk && statusOk);
  const totalPrizePool = isActive ? poolFromRace(race, rewards) : 0;
  return {
    isActive,
    totalPrizePool,
    startTime: race.startTime.toISOString(),
    endTime: race.endTime.toISOString(),
    status: race.status,
  };
}

export function raceStatusCacheRecordToDto(
  record: RaceStatusCacheRecord,
  now: Date = new Date(),
): { isActive: boolean; totalPrizePool: number } {
  const start = new Date(record.startTime);
  const end = new Date(record.endTime);
  const windowOk = start <= now && now < end;
  const statusOk =
    record.status === RaceStatus.ACTIVE || record.status === RaceStatus.PAUSED;
  const live = windowOk && statusOk;
  return {
    isActive: live,
    totalPrizePool: live ? record.totalPrizePool : 0,
  };
}

export function raceAndRewardsToStatusDto(
  race: RaceRecord,
  rewards: RaceRewardAmountRow[],
  now: Date = new Date(),
): { isActive: boolean; totalPrizePool: number } {
  return raceStatusCacheRecordToDto(
    buildRaceStatusCacheRecord(race, rewards, now),
    now,
  );
}
