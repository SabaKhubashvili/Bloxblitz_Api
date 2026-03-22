/** Central tuning for loss-based rakeback (see domain rakeback accrual policy). */
export const RAKEBACK_ANTI_ABUSE = {
  /** Bets below this do not move eligible wager / won counters or rakeback. */
  MIN_RAKEBACK_BET: 1,

  /** Max combined positive rakeback accrual (daily+weekly+monthly) per UTC calendar day. */
  MAX_DAILY_RAKEBACK: 500,

  /** Hard cap on a single event’s contribution to eligible totals (abuse / float safety). */
  MAX_ELIGIBLE_INCREMENT: 50_000_000,

  /** Redis key TTL (seconds) for rapid-bet spam logging. */
  RAPID_BET_WINDOW_SEC: 60,

  /** Log when a user exceeds this many rakeback-eligible events in the window. */
  RAPID_BET_WARN_THRESHOLD: 80,
} as const;
