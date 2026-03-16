import { Injectable } from '@nestjs/common';
import { IUserSeedRepository } from '../../../../domain/user/ports/user-seed.repository.port';
import { UserSeed } from '../../../../domain/user/entities/user-seed.entity';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../../cache/redis.service';
import { RedisKeys } from '../../../cache/redis.keys';

/** TTL for user seed cache (1 hour). Invalidation happens on client/server seed updates. */
const USER_SEED_CACHE_TTL_SECONDS = 3600;

interface CachedUserSeed {
  activeServerSeed: string;
  activeServerSeedHash: string;
  activeClientSeed: string;
}

@Injectable()
export class UserSeedRepository implements IUserSeedRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findByusername(username: string): Promise<UserSeed | null> {
    const seedKey = RedisKeys.user.userSeed(username);
    const nonceKey = RedisKeys.user.nonce(username);

    // 1. Try Redis cache first (clientSeed, activeSeed, serverSeedHash)
    const cached = await this.redis.get<CachedUserSeed>(seedKey);
    if (cached) {
      let nonce = await this.redis.getNumber(nonceKey);
      if (nonce === null) {
        const fallback = await this.prisma.userSeed.findUnique({
          where: { userUsername: username },
          select: { totalGamesPlayed: true },
        });
        nonce = fallback?.totalGamesPlayed ?? 0;
      }
      return new UserSeed(
        username,
        cached.activeServerSeed,
        cached.activeServerSeedHash,
        cached.activeClientSeed,
        nonce,
      );
    }

    // 2. Cache miss — read from DB
    const record = await this.prisma.userSeed.findUnique({
      where: { userUsername: username },
    });
    if (!record) return null;

    // 3. Populate cache for future reads
    const toCache: CachedUserSeed = {
      activeServerSeed: record.activeServerSeed,
      activeServerSeedHash: record.activeServerSeedHash,
      activeClientSeed: record.activeClientSeed,
    };
    await this.redis.set(seedKey, toCache, USER_SEED_CACHE_TTL_SECONDS);

    // Nonce is tracked in Redis for atomic increments; fall back to DB count.
    const cachedNonce = await this.redis.getNumber(nonceKey);
    const nonce = cachedNonce ?? record.totalGamesPlayed;

    return new UserSeed(
      username,
      record.activeServerSeed,
      record.activeServerSeedHash,
      record.activeClientSeed,
      nonce,
    );
  }
}
