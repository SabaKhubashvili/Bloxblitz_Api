import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';

@Injectable()
export class SharedBalanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getUserBalance(username: string): Promise<number> {
    // Try Redis first
    const cached = await this.redis.mainClient.get(
      RedisKeys.user.balance.user(username),
    );
    if (cached !== null) {
      return parseFloat(cached);
    }

    // Cache miss - fetch from DB
    const userBalance = await this.prisma.$queryRaw<{ balance: number }[]>`
      SELECT balance FROM "User" WHERE "username" = ${username}
    `;

    const balance = userBalance[0]?.balance || 0;

    // Populate Redis cache
    await this.redis.mainClient.set(
      RedisKeys.user.balance.user(username),
      balance.toFixed(2),
    );

    return balance;
  }
}
