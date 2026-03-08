import { Injectable } from '@nestjs/common';
import { IUserSeedRepository } from '../../../../domain/user/ports/user-seed.repository.port';
import { UserSeed } from '../../../../domain/user/entities/user-seed.entity';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../../cache/redis.service';

const nonceKey = (username: string) => `user:nonce:${username}`;

@Injectable()
export class UserSeedRepository implements IUserSeedRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findByusername(username: string): Promise<UserSeed | null> {
    const record = await this.prisma.userSeed.findUnique({
      where: { userUsername: username },
    });

    if (!record) return null;

    // Nonce is tracked in Redis for atomic increments; fall back to DB count.
    const cachedNonce = await this.redis.getNumber(nonceKey(username));
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
