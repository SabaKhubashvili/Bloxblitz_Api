import { SpinPrize } from './spin-prize.vo';

/**
 * Immutable value object representing a complete wager-tier prize configuration.
 * Encapsulates all six prize slots and provides the pre-computed total weight
 * used by SpinPolicy for O(n) weighted random selection.
 */
export class SpinTier {
  readonly tier: number;
  readonly minWager: number;
  readonly prizes: readonly SpinPrize[];

  private readonly _totalWeight: number;

  private constructor(
    tier: number,
    minWager: number,
    prizes: readonly SpinPrize[],
  ) {
    this.tier = tier;
    this.minWager = minWager;
    this.prizes = prizes;
    this._totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
  }

  static create(
    tier: number,
    minWager: number,
    prizes: readonly SpinPrize[],
  ): SpinTier {
    if (prizes.length === 0)
      throw new Error('SpinTier must have at least one prize');
    if (minWager < 0) throw new Error('SpinTier minWager must be non-negative');
    return new SpinTier(tier, minWager, prizes);
  }

  get totalWeight(): number {
    return this._totalWeight;
  }
}
