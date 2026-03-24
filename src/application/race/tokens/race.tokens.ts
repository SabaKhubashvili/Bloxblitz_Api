export const RACE_REPOSITORY = Symbol('RACE_REPOSITORY');
export const RACE_CACHE = Symbol('RACE_CACHE');

export const RACE_CACHE_TTL = {
  currentSec: 120,
  top10Sec: 45,
  userRankSec: 45,
} as const;
