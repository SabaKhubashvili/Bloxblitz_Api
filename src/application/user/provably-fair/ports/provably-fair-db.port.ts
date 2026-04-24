export interface ProvablyFairDataFromDb {
  clientSeed: string;
  serverSeedHash: string;
  nextServerSeedHash: string;
  totalGamesPlayed: number;
}

export interface IProvablyFairDbPort {
  getProvablyFairData(username: string): Promise<ProvablyFairDataFromDb | null>;

  rotateClientSeed(
    username: string,
    clientSeed?: string,
  ): Promise<{
    success: boolean;
    clientSeed: string;
    serverSeedHash: string;
    nextServerSeedHash: string;
    totalGamesPlayed: number;
    activeGames?: string[];
  } | null>;
}
