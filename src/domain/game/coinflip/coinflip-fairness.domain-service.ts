import { Injectable } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';

/**
 * Coinflip provably fair — must match {@link CoinflipFairnessService} in `ws`.
 * HMAC-SHA256(key=serverSeed, message=`${nonce}:${eosBlockId}`).
 */
@Injectable()
export class CoinflipFairnessDomainService {
  hashToFloat(hashHex: string): number {
    return parseInt(hashHex.substring(0, 8), 16) / 0xffff_ffff;
  }

  computeOutcomeHash(serverSeed: string, nonce: string, eosBlockId: string): string {
    return createHmac('sha256', serverSeed)
      .update(`${nonce}:${eosBlockId}`)
      .digest('hex');
  }

  commitmentSha256(serverSeed: string): string {
    return createHash('sha256').update(serverSeed, 'utf8').digest('hex');
  }

  deriveRandomValue(serverSeed: string, nonce: string, eosBlockId: string): number {
    const h = this.computeOutcomeHash(serverSeed, nonce, eosBlockId);
    return this.hashToFloat(h);
  }
}
