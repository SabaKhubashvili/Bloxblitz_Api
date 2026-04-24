import type { XpSource } from '../../../../domain/leveling/enums/xp-source.enum';

export interface AddExperienceCommand {
  readonly username: string;
  readonly amount: number;
  readonly source: XpSource;
  readonly referenceId?: string;
  /** When set (e.g. games), used to grant reward-case keys from wagering. */
  readonly wagerCoins?: number;
}
