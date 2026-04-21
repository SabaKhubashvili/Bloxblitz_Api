import type { XpSource } from '../../../../domain/leveling/enums/xp-source.enum';

/**
 * Command for persisting wager-linked XP after the game-specific amount is computed.
 * Callers own the formula (rates, floors, win/lose branches); this DTO only carries inputs to {@link GrantWagerXpUseCase}.
 */
export interface GrantWagerXpCommand {
  readonly username: string;
  /** Pre-computed XP to add (game-specific formula applied by caller). */
  readonly xpAmount: number;
  readonly wager: number;
  /** Correlates with `referenceId` passed to {@link AddExperienceUseCase} (e.g. game history id, open id). */
  readonly gameId: string;
  readonly source: XpSource;
  /** Optional log/trace tag (e.g. `mines.reveal.auto_win`) — not used for business rules. */
  readonly grantContext?: string;
}
