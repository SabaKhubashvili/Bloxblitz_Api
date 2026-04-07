export const RACE_REPOSITORY = Symbol('RACE_REPOSITORY');
export const RACE_CACHE = Symbol('RACE_CACHE');

export const RACE_CACHE_TTL = {
  currentSec: 120,
  top10Sec: 45,
  userRankSec: 45,
  /** When no live race exists — small JSON in `race:public:status` to keep `/race/status` DB-free. */
  statusAbsentSec: 15,
} as const;
