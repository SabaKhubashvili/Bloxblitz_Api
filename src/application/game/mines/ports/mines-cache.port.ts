export interface AtomicRevealResult {
  success: boolean;
}

export interface RawGameState {
  id: string;
  username: string;
  betAmount: number;
  mineCount: number;
  minePositions: number[];
  gridSize: number;
  nonce: number;
  revealedTiles: number[];
  status: string;
}

/**
 * Pure game-state operations for the Mines game Redis cache.
 *
 * Balance mutations (bet deduction, payout crediting) are intentionally
 * absent — those live exclusively in IMinesBalanceLedgerPort so there is
 * one authoritative place for every coin movement.
 */
export interface IMinesCachePort {
  atomicRevealTile(
    gameId: string,
    tileIndex: number,
    updates: Record<string, unknown>,
  ): Promise<AtomicRevealResult>;
  getActiveGame(username: string): Promise<RawGameState | null>;
  getGameById(gameId: string): Promise<RawGameState | null>;
  deleteActiveGame(username: string, gameId: string): Promise<void>;
  updateGame(gameId: string, updates: Record<string, unknown>): Promise<void>;
}
