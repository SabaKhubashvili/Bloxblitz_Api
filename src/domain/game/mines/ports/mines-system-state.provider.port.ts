/**
 * Fast view of global Mines ops mode (backed by Redis in infrastructure).
 * Use-cases must consult this before any mutating gameplay step.
 */
export interface MinesSystemStateProvider {
  isPaused(): Promise<boolean>;

  /** True when new games are not allowed (NEW_GAMES_DISABLED or PAUSED). */
  isNewGamesDisabled(): Promise<boolean>;
}

/** Values stored at `mines:system:state` (admin-api). */
export enum MinesSystemMode {
  ACTIVE = 'ACTIVE',
  NEW_GAMES_DISABLED = 'NEW_GAMES_DISABLED',
  PAUSED = 'PAUSED',
}
