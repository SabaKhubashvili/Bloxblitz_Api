import { Result, Ok, Err } from '../../shared/types/result.type';
import { LevelVO } from '../value-objects/level.vo';
import { XpAmount } from '../value-objects/xp-amount.vo';
import { XpCalculationDomainService } from '../services/xp-calculation.domain-service';
import {
  InvalidXpAmountError,
  InvalidLevelError,
} from '../errors/leveling.errors';
import { Tier } from '../enums/tier.enum';
import type { XpSource } from '../enums/xp-source.enum';

// ── Value types ────────────────────────────────────────────────────────────────

export interface LevelProgressProps {
  readonly username: string;
  readonly totalXp: XpAmount;
  readonly currentLevel: LevelVO;
  readonly xpMultiplier: number;
}

export interface XpGainResult {
  readonly previousLevel: number;
  readonly newLevel: number;
  readonly leveledUp: boolean;
  readonly tiersGained: number;
  readonly tier: Tier;
  readonly tierName: string;
  readonly totalXp: number;
}

export interface XpEventRecord {
  readonly username: string;
  readonly amount: number;
  readonly source: XpSource;
  readonly referenceId?: string;
}

// ── Entity ─────────────────────────────────────────────────────────────────────

/**
 * Aggregate root for the Leveling bounded context.
 *
 * All mutation methods are pure (no I/O) and return a typed Result so the
 * calling use-case can decide whether to propagate an error or handle it.
 */
export class LevelProgress {
  private _totalXp: XpAmount;
  private _currentLevel: LevelVO;

  private constructor(private readonly props: LevelProgressProps) {
    this._totalXp = props.totalXp;
    this._currentLevel = props.currentLevel;
  }

  // ── Factories ──────────────────────────────────────────────────────────────

  static create(props: LevelProgressProps): LevelProgress {
    return new LevelProgress(props);
  }

  /** Re-hydrates a previously-persisted aggregate without re-running invariants. */
  static reconstitute(props: LevelProgressProps): LevelProgress {
    return new LevelProgress(props);
  }

  // ── Read accessors ─────────────────────────────────────────────────────────

  get username(): string {
    return this.props.username;
  }
  get totalXp(): number {
    return this._totalXp.value;
  }
  get currentLevel(): number {
    return this._currentLevel.value;
  }
  get xpMultiplier(): number {
    return this.props.xpMultiplier;
  }
  get tier(): Tier {
    return this._currentLevel.getTier();
  }
  get tierNumber(): number {
    return this._currentLevel.getTierNumber();
  }
  get tierName(): string {
    return this._currentLevel.getTierName();
  }

  getXpProgress(): {
    currentLevelXp: number;
    nextLevelXp: number;
    progress: number;
  } {
    return XpCalculationDomainService.xpProgressInLevel(
      this._totalXp.value,
      this._currentLevel.value,
    );
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  /**
   * Adds XP (after applying the user's multiplier), recalculates the level,
   * and returns a summary of what changed.
   *
   * If `rawAmount` is negative or non-finite an Err is returned and the entity
   * state is NOT mutated.
   */
  addExperience(rawAmount: number): Result<XpGainResult, InvalidXpAmountError> {
    if (rawAmount < 0 || !Number.isFinite(rawAmount)) {
      return Err(new InvalidXpAmountError(rawAmount));
    }

    const effectiveAmount = Math.floor(rawAmount * this.props.xpMultiplier);
    const newXp = this._totalXp.add(XpAmount.of(effectiveAmount));
    const newLevelValue = XpCalculationDomainService.calculateLevelFromXp(
      newXp.value,
    );
    const previousLevel = this._currentLevel.value;
    const previousTier = this._currentLevel.getTierNumber();

    this._totalXp = newXp;
    this._currentLevel = LevelVO.create(newLevelValue);

    return Ok({
      previousLevel,
      newLevel: this._currentLevel.value,
      leveledUp: this._currentLevel.value > previousLevel,
      tiersGained: this._currentLevel.getTierNumber() - previousTier,
      tier: this._currentLevel.getTier(),
      tierName: this._currentLevel.getTierName(),
      totalXp: this._totalXp.value,
    });
  }

  /**
   * Administratively forces the level to a specific value.
   * The stored total XP is bumped to the minimum XP floor for that level if it
   * is currently below it, so the two values always stay consistent.
   */
  setLevel(newLevel: number): Result<void, InvalidLevelError> {
    try {
      const levelVO = LevelVO.of(newLevel);
      const minXp = XpCalculationDomainService.xpRequiredForLevel(newLevel);
      this._currentLevel = levelVO;
      if (this._totalXp.value < minXp) {
        this._totalXp = XpAmount.of(minXp);
      }
      return Ok(undefined);
    } catch {
      return Err(new InvalidLevelError(newLevel));
    }
  }
}
