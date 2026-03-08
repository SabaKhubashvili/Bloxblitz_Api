import { Result, Ok, Err } from '../../shared/types/result.type';
import { SpinPrize } from '../value-objects/spin-prize.vo';
import { SpinTier }  from '../value-objects/spin-tier.vo';
import { SpinPolicy } from '../policies/spin.policy';
import {
  DailySpinLockedError,
  DailySpinCooldownActiveError,
  type DailySpinError,
} from '../errors/daily-spin.errors';

// ── Result type returned from spin() ─────────────────────────────────────────

export interface SpinOutcome {
  readonly prize: SpinPrize;
  readonly tier: SpinTier;
  readonly nextSpinAt: Date;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface DailySpinStateProps {
  readonly id: string;
  readonly username: string;
  lastSpinAt: Date | null;
  nextSpinAt: Date | null;
}

/**
 * Aggregate root for the daily-spin feature.
 *
 * Domain invariants enforced here:
 *   - Level >= 3 before first spin (DAILY_SPIN_LOCKED)
 *   - Rolling 24-hour cooldown between spins (DAILY_SPIN_COOLDOWN_ACTIVE)
 *
 * State mutation is intentionally minimal: only lastSpinAt / nextSpinAt
 * are updated when a spin succeeds.
 */
export class DailySpinState {
  readonly id: string;
  readonly username: string;
  lastSpinAt: Date | null;
  nextSpinAt: Date | null;

  private constructor(props: DailySpinStateProps) {
    this.id        = props.id;
    this.username  = props.username;
    this.lastSpinAt = props.lastSpinAt;
    this.nextSpinAt = props.nextSpinAt;
  }

  // ── Factory ──────────────────────────────────────────────────────────────

  static create(username: string): DailySpinState {
    return new DailySpinState({
      id: crypto.randomUUID(),
      username,
      lastSpinAt: null,
      nextSpinAt: null,
    });
  }

  static fromPersistence(props: DailySpinStateProps): DailySpinState {
    return new DailySpinState(props);
  }

  // ── Domain behaviour ─────────────────────────────────────────────────────

  /**
   * Attempts a spin. Validates level requirement and cooldown, resolves the
   * correct tier from the 30-day wager, and performs a weighted random draw.
   *
   * On success the aggregate's state is mutated in-place (lastSpinAt, nextSpinAt)
   * so that the repository can persist it without re-reading from the entity.
   */
  spin(
    userLevel: number,
    wager30d: number,
    now: Date,
  ): Result<SpinOutcome, DailySpinError> {
    if (!SpinPolicy.meetsLevelRequirement(userLevel)) {
      return Err(new DailySpinLockedError());
    }

    if (SpinPolicy.isCooldownActive(this.lastSpinAt, now)) {
      return Err(new DailySpinCooldownActiveError(SpinPolicy.nextSpinAt(this.lastSpinAt!)));
    }

    const tier       = SpinPolicy.resolveTier(wager30d);
    const prize      = SpinPolicy.selectPrize(tier);
    const nextSpinAt = SpinPolicy.nextSpinAt(now);

    // Mutate state — repository will persist this
    this.lastSpinAt = now;
    this.nextSpinAt = nextSpinAt;

    return Ok({ prize, tier, nextSpinAt });
  }

  /** Pure read — does not mutate state. */
  canSpin(userLevel: number, now: Date): boolean {
    return (
      SpinPolicy.meetsLevelRequirement(userLevel) &&
      !SpinPolicy.isCooldownActive(this.lastSpinAt, now)
    );
  }
}
