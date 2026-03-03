import { Tier } from '../enums/tier.enum.js';
import {
  resolveLevelName,
  resolveTier,
  resolveTierNumber,
} from '../mappers/level-to-level-name.mapper.js';

/**
 * Immutable value-object for a player level in the range [0, 100].
 *
 * Two factory methods:
 *   - LevelVO.create()  → clamps silently to [0, 100] (use for domain mutations)
 *   - LevelVO.of()      → throws if the value is out of range (use for input validation)
 */
export class LevelVO {
  static readonly MIN = 0;
  static readonly MAX = 100;

  private constructor(private readonly _value: number) {}

  static create(raw: number): LevelVO {
    const clamped = Math.max(LevelVO.MIN, Math.min(LevelVO.MAX, Math.floor(raw)));
    return new LevelVO(clamped);
  }

  static of(raw: number): LevelVO {
    if (!Number.isInteger(raw) || raw < LevelVO.MIN || raw > LevelVO.MAX) {
      throw new RangeError(
        `Level must be an integer between ${LevelVO.MIN} and ${LevelVO.MAX}, got ${raw}`,
      );
    }
    return new LevelVO(raw);
  }

  get value(): number {
    return this._value;
  }

  getTierNumber(): number {
    return resolveTierNumber(this._value);
  }

  getTier(): Tier {
    return resolveTier(this._value);
  }

  getTierName(): string {
    return resolveLevelName(this._value);
  }

  isMax(): boolean {
    return this._value === LevelVO.MAX;
  }

  equals(other: LevelVO): boolean {
    return this._value === other._value;
  }
}
