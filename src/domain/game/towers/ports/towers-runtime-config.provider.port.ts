export type TowersRuntimeConfig = {
  minBet: number;
  maxBet: number;
  allowedDifficulties: string[];
  allowedLevels: number[];
};

export interface TowersRuntimeConfigProvider {
  getConfig(): Promise<TowersRuntimeConfig>;
}
