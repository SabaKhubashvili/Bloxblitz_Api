import * as crypto from 'crypto';

/**
 * Canonical SHA-256 hash for provably fair server seeds.
 *
 * Used consistently across:
 * - UserSeed (activeServerSeedHash, nextServerSeedHash)
 * - SeedRotationHistory (serverSeedHash)
 * - OnlinePlayerFairness (serverSeedHash)
 *
 * Formula: serverSeedHash = SHA256(serverSeed) as hex (64 chars)
 */
export function sha256HashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}
