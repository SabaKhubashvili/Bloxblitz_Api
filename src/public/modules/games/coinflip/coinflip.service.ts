import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
@Injectable()
export class CoinflipService {
  constructor() {}

  verify(data: { serverSeed: string; nonce: string; eosBlockId: string }): {
    isValid: boolean;
    recomputedHash: string;
    recomputedValue: number;
  } {
    const recomputedPublicSeed = crypto
      .createHash('sha256')
      .update(data.serverSeed)
      .digest('hex');

    const hmac = crypto.createHmac('sha256', data.serverSeed);
    hmac.update(`${data.nonce}:${data.eosBlockId}`);
    const recomputedHash = hmac.digest('hex');
    const recomputedValue = this.hashToFloat(recomputedHash);

    return {
      isValid:
        recomputedPublicSeed.length === 64 && recomputedHash.length === 64,
      recomputedHash,
      recomputedValue,
    };
  }

  hashToFloat(hash: string): number {
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }
}
