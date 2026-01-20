import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';

@Injectable()
export class SharedUserProvablyFairService {
  private readonly logger = new Logger(SharedUserProvablyFairService.name);
    private readonly CACHE_TTL = 3000; 

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getUserClientSeed(username: string): Promise<string | null> {
    const cacheKey = RedisKeys.user.userSeed(username);

    const cached = await this.redisService.mainClient.get(cacheKey);
    if (cached) {
      this.logger.debug(`Seed cache HIT for ${username}`);
      return JSON.parse(cached);
    }

    this.logger.debug(`Seed cache MISS for ${username} - key: ${cacheKey}`);

    // Cache miss - fetch from database
    let userSeed = await this.prismaService.userSeed.findUnique({
      where: { userUsername: username },
    });

    // Create if doesn't exist
    if (!userSeed) {
      this.logger.debug(`Creating new seed for ${username}`);
      return ""
    }

    const seedData = {
      id: userSeed.id,
      activeServerSeed: userSeed.activeServerSeed,
      activeServerSeedHash: userSeed.activeServerSeedHash,
      activeClientSeed: userSeed.activeClientSeed,
      nextServerSeedHash: userSeed.nextServerSeedHash,
      nextServerSeed: userSeed.nextServerSeed,
      totalGamesPlayed: userSeed.totalGamesPlayed,
      maxGamesPerSeed: userSeed.maxGamesPerSeed,
      seedCreatedAt: userSeed.seedCreatedAt,
    };

    // Cache for future request
    this.logger.debug(
      `Setting cache for ${username} with key: ${cacheKey}, TTL: ${this.CACHE_TTL}s`,
    );
    const response = await this.redisService.mainClient.setEx(
      cacheKey,
      this.CACHE_TTL,
      JSON.stringify(seedData),
    );

    this.logger.debug(`Redis setEx response: ${response}`);

    // Verify it was actually set
    const verification = await this.redisService.mainClient.get(cacheKey);
    this.logger.debug(
      `Cache verification for ${username}: ${verification ? 'EXISTS' : 'NOT FOUND'}`,
    );

    return seedData.activeClientSeed || null;
  }
}
