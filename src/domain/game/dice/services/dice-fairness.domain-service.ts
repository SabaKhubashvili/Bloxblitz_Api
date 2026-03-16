import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';

/**
 * Provably fair dice roll using HMAC-SHA256.
 *
 * Steps:
 * 1. Hash serverSeed + clientSeed + nonce using HMAC-SHA256
 * 2. Convert hash to a number (first 8 hex chars = 32 bits)
 * 3. Map to 0.00–100.00 range
 *
 * Formula: result = (hashValue % 10000) / 100
 * This gives 10000 possible outcomes (0.00 to 99.99), effectively 0.00–100.00
 */
@Injectable()
export class DiceFairnessDomainService {
  /**
   * Generates a provably fair roll result between 0.00 and 100.00
   */
  generateRollResult(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
  ): number {
    // HMAC-SHA256(serverSeed, clientSeed:nonce) — server seed as key, client data as message
    const message = `${clientSeed}:${nonce}`;
    const hmac = createHmac('sha256', serverSeed).update(message).digest('hex');

    // Take first 8 hex chars (32 bits) for sufficient entropy
    const hashValue = parseInt(hmac.slice(0, 8), 16);
    // Map to 0.00 - 100.00 (10000 possible values)
    const result = (hashValue % 10000) / 100;
    return Math.round(result * 100) / 100;
  }

  calculateMultiplierUnder(chance: number, houseEdgePercent: number = 1): number {
    const effectiveChance = Math.max(0.01, Math.min(99.99, chance));
    return (100 - houseEdgePercent) / effectiveChance;
  }
  
  calculateMultiplierOver(chance: number, houseEdgePercent: number = 1): number {
    const effectiveChance = Math.max(0.01, Math.min(99.99, chance));
    return (100 - houseEdgePercent) / effectiveChance;
  }

  /**
   * Determine if roll wins based on mode
   */
  isWin(rollResult: number, chance: number, rollMode: 'OVER' | 'UNDER'): boolean {
    if (rollMode === 'UNDER') {
      return rollResult < chance;
    }
    return rollResult > 100 - chance;
  }
}
