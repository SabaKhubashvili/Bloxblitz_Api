import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';

/**
 * Provably fair [0, 1) roll for case openings.
 * Uses the same HMAC-SHA256 shape as dice (serverSeed as key, `clientSeed:nonce` message)
 * but maps the first 32 bits uniformly to [0, 1) via division by 2^32.
 */
@Injectable()
export class CaseFairnessDomainService {
  private static readonly UINT32 = 0x1_0000_0000;

  generateNormalizedRoll(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
  ): number {
    const message = `${clientSeed}:${nonce}`;
    const hmac = createHmac('sha256', serverSeed).update(message).digest('hex');
    const hashValue = parseInt(hmac.slice(0, 8), 16);
    return hashValue / CaseFairnessDomainService.UINT32;
  }

  /**
   * Stable weighted draw: sort by sortOrder then id, map roll ∈ [0,1) to a ticket in [0, totalWeight).
   */
  selectWeightedItemId(
    items: ReadonlyArray<{ id: string; weight: number; sortOrder: number }>,
    normalizedRoll: number,
  ): string {
    const sorted = [...items].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.id.localeCompare(b.id);
    });
    const totalWeight = sorted.reduce((s, i) => s + i.weight, 0);
    if (totalWeight <= 0) {
      throw new Error('CASE_WEIGHTED_PICK_EMPTY');
    }
    const ticket = Math.floor(normalizedRoll * totalWeight);
    let acc = 0;
    for (const row of sorted) {
      acc += row.weight;
      if (ticket < acc) return row.id;
    }
    return sorted[sorted.length - 1]!.id;
  }
}
