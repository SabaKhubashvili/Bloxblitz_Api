/** Values stored at `towers:system:state` (admin-api); same shape as Mines. */
export enum TowersSystemMode {
  ACTIVE = 'ACTIVE',
  NEW_GAMES_DISABLED = 'NEW_GAMES_DISABLED',
  PAUSED = 'PAUSED',
}

export interface TowersSystemStateProvider {
  isPaused(): Promise<boolean>;
  isNewGamesDisabled(): Promise<boolean>;
}
