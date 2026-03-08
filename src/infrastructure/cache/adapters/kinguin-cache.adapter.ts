import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service';
import type { IKinguinCachePort } from '../../../application/kinguin/ports/kinguin-cache.port';

const LOCK_PREFIX = 'lock:kinguin:code:';

@Injectable()
export class KinguinCacheAdapter implements IKinguinCachePort {
  constructor(private readonly redis: RedisService) {}

  async acquireCodeLock(codeHash: string, ttlMs: number): Promise<boolean> {
    return this.redis.lock(`${LOCK_PREFIX}${codeHash}`, ttlMs);
  }

  async releaseCodeLock(codeHash: string): Promise<void> {
    await this.redis.unlock(`${LOCK_PREFIX}${codeHash}`);
  }
}
