/**
 * Leaderboard ordering: `wageredAmount` DESC, then `updatedAt` ASC (earlier stake wins ties).
 *
 * Returns a negative value when `a` should appear above `b` on the leaderboard.
 * Uses numeric comparison for wager amounts (repository guarantees sane precision).
 */
export function compareRaceLeaderboardParticipants(
  wagerA: number,
  updatedAtA: Date,
  wagerB: number,
  updatedAtB: Date,
): number {
  if (wagerA !== wagerB) {
    return wagerB - wagerA;
  }
  return updatedAtA.getTime() - updatedAtB.getTime();
}
