import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GameType } from '@prisma/client';
import { RedisService } from 'src/provider/redis/redis.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { SharedUserGamesService } from 'src/shared/user/games/shared-user-games.service';

interface UserSeedData {
  id: string;
  activeServerSeed: string;
  activeServerSeedHash: string;
  activeClientSeed: string;
  nextServerSeedHash: string;
  nextServerSeed: string;
  totalGamesPlayed: number;
  maxGamesPerSeed: number;
  seedCreatedAt: Date;
}

@Injectable()
export class SeedManagementService implements OnModuleInit {
  private readonly logger = new Logger(SeedManagementService.name);

  // Cache TTL (24 hours)
  private readonly CACHE_TTL = 86400;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly sharedUserGamesService: SharedUserGamesService,
  ) {}

  async onModuleInit() {
    this.logger.log('SeedManagementService initialized');
  }

  /* ============================================
     CORE SEED OPERATIONS
  ============================================ */

  /**
   * Get user's seed data with Redis caching
   * OPTIMIZED: Non-blocking cache write
   */
  async getUserSeed(username: string): Promise<UserSeedData> {
    const cacheKey = RedisKeys.user.userSeed(username);

    try {
      // Try cache first (should be <1ms)
      const cached = await this.redis.mainClient.get(cacheKey);

      if (cached) {
        this.logger.debug(`Seed cache hit for ${username}`);
        return JSON.parse(cached);
      }

      // Cache miss - fetch from database
      this.logger.debug(`Seed cache miss for ${username}`);
      
      let userSeed = await this.prisma.userSeed.findUnique({
        where: { userUsername: username },
      });

      if (!userSeed) {
        userSeed = await this.createUserSeed(username);
      }

      const seedData: UserSeedData = {
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

      // Cache it (fire-and-forget, don't block)
      this.redis.mainClient
        .setEx(cacheKey, this.CACHE_TTL, JSON.stringify(seedData))
        .catch((err) => this.logger.error('Failed to cache seed:', err));

      return seedData;
    } catch (error) {
      this.logger.error(`Error getting user seed for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Get only the public seed info (no server seed)
   */
  async getPublicSeedInfo(username: string) {
    const seed = await this.getUserSeed(username);
    this.logger.log(`seed info: ${JSON.stringify(seed)}`);
    const activeGames =
      await this.sharedUserGamesService.getActiveGames(username);
      this.logger.log(`Active games for ${username}: ${activeGames.length}`);

    return {
      serverSeedHash: seed.activeServerSeedHash,
      clientSeed: seed.activeClientSeed,
      nextServerSeedHash: seed.nextServerSeedHash,
      totalGamesPlayed: seed.totalGamesPlayed,
      maxGamesPerSeed: seed.maxGamesPerSeed,
      activeGames: activeGames.map((g) => g.gameType),
    };
  }

  /**
   * Create initial seed pair for new user
   */
  private async createUserSeed(username: string) {
    this.logger.log(`Creating initial seed pair for ${username}`);

    const activeServerSeed = randomBytes(32).toString('hex');
    const activeServerSeedHash = createHash('sha256')
      .update(activeServerSeed)
      .digest('hex');

    const nextServerSeed = randomBytes(32).toString('hex');
    const nextServerSeedHash = createHash('sha256')
      .update(nextServerSeed)
      .digest('hex');

    const activeClientSeed = randomBytes(16).toString('hex');

    const userSeed = await this.prisma.userSeed.create({
      data: {
        userUsername: username,
        activeServerSeed,
        activeServerSeedHash,
        activeClientSeed,
        nextServerSeed,
        nextServerSeedHash,
      },
    });

    // Cache immediately
    const seedData: UserSeedData = {
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

    await this.redis.mainClient.setEx(
      RedisKeys.user.userSeed(username),
      this.CACHE_TTL,
      JSON.stringify(seedData),
    );

    return userSeed;
  }

  /* ============================================
     NONCE MANAGEMENT
  ============================================ */

  /**
   * Get and increment nonce atomically using Redis
   * OPTIMIZED: Async database sync
   */
  async getAndIncrementNonce(
    username: string,
    gameType: GameType,
  ): Promise<number> {
    const nonceKey = RedisKeys.user.nonce(username);

    try {
      // Atomic increment in Redis
      const nonce = await this.redis.incr(nonceKey);

      // Set expiry on first increment
      if (nonce === 1) {
        await this.redis.expire(nonceKey, this.CACHE_TTL);
      }

      // Async sync to database (fire and forget)
      this.syncNonceToDatabase(username, nonce).catch((err) => {
        this.logger.error(`Failed to sync nonce to database:`, err);
      });

      this.logger.debug(
        `Nonce incremented: ${username}:${gameType} -> ${nonce}`,
      );
      return nonce;
    } catch (error) {
      this.logger.warn(
        `Redis nonce increment failed, falling back to database`,
      );
      return await this.getDatabaseNonce(username);
    }
  }

  /**
   * Get current nonce without incrementing
   */
  async getCurrentNonce(username: string): Promise<number> {
    const nonceKey = RedisKeys.user.nonce(username);

    try {
      const nonce = await this.redis.get(nonceKey);
      if (nonce) {
        return parseInt(nonce, 10);
      }

      // Fetch from database
      const dbNonce = await this.prisma.userSeed.findUnique({
        where: { userUsername: username },
        select: { totalGamesPlayed: true },
      });

      const currentNonce = dbNonce?.totalGamesPlayed || 0;

      // Cache it (fire-and-forget)
      this.redis.mainClient
        .setEx(nonceKey, this.CACHE_TTL, currentNonce.toString())
        .catch(() => {});

      return currentNonce;
    } catch (error) {
      this.logger.error(`Error getting nonce:`, error);
      throw error;
    }
  }

  /**
   * Database fallback for nonce increment
   */
  private async getDatabaseNonce(username: string): Promise<number> {
    const result = await this.prisma.userSeed.update({
      where: { userUsername: username },
      data: { totalGamesPlayed: { increment: 1 } },
      select: { totalGamesPlayed: true },
    });

    // Update cache (fire-and-forget)
    const nonceKey = RedisKeys.user.nonce(username);
    this.redis.mainClient
      .setEx(nonceKey, this.CACHE_TTL, result.totalGamesPlayed.toString())
      .catch(() => {});

    return result.totalGamesPlayed;
  }

  /**
   * OPTIMIZED: Sync Redis nonce to database
   * Made public so it can be called from MinesGameFactory
   */
  async syncNonceToDatabase(username: string, nonce: number): Promise<void> {
    try {
      const seed = await this.getUserSeed(username);

      await this.prisma.userSeed.update({
        where: { id: seed.id },
        data: { totalGamesPlayed: nonce },
      });

      this.logger.debug(`Synced nonce ${nonce} to database for ${username}`);
    } catch (error) {
      this.logger.error(`Error syncing nonce to database:`, error);
      throw error;
    }
  }

  /* ============================================
     SEED ROTATION (OPTIMIZED)
  ============================================ */

  /**
   * OPTIMIZED: Single Lua script for all Redis operations
   */
  async rotateSeed(
    username: string,
    newClientSeed?: string,
    rotationType: 'MANUAL' | 'AUTOMATIC' | 'CLIENT_SEED_CHANGE' = 'MANUAL',
  ) {
    const startTime = performance.now();
    const lockKey = RedisKeys.user.lockSeed(username);
    const lockValue = randomBytes(16).toString('hex');

    try {
      // Acquire distributed lock
      const locked = await this.acquireLock(lockKey, lockValue, 10);
      if (!locked) {
        throw new BadRequestException('Seed rotation already in progress');
      }

      // Check for active games using Lua
      this.logger.log(`Checking active games for ${username} before rotation`);
      const activeGamesCount = await this.checkActiveGamesLua(username);
      this.logger.log(
        `Active games count for ${username}: ${activeGamesCount}`,
      );
      if (activeGamesCount > 0) {
        throw new BadRequestException(
          'Cannot rotate seed with active games in progress',
        );
      }

      // Get current seed
      const userSeed = await this.getUserSeed(username);

      // Generate new seeds (CPU-bound, no I/O)
      const newNextServerSeed = randomBytes(32).toString('hex');
      const newNextServerSeedHash = createHash('sha256')
        .update(newNextServerSeed)
        .digest('hex');
      const rotationId = randomBytes(16).toString('hex');
      const now = new Date();

      const rotationData = {
        id: rotationId,
        userUsername: username,
        serverSeed: userSeed.activeServerSeed,
        serverSeedHash: userSeed.activeServerSeedHash,
        clientSeed: userSeed.activeClientSeed,
        totalGamesPlayed: userSeed.totalGamesPlayed,
        seedActivatedAt: userSeed.seedCreatedAt,
        seedRotatedAt: now,
        rotationType,
        userSeedId: userSeed.id,
        firstNonce: 1,
        lastNonce: userSeed.totalGamesPlayed,
      };

      const updatedSeedData: UserSeedData = {
        id: userSeed.id,
        activeServerSeed: userSeed.nextServerSeed,
        activeServerSeedHash: userSeed.nextServerSeedHash,
        activeClientSeed: newClientSeed || userSeed.activeClientSeed,
        nextServerSeedHash: newNextServerSeedHash,
        nextServerSeed: newNextServerSeed,
        totalGamesPlayed: 0,
        maxGamesPerSeed: userSeed.maxGamesPerSeed,
        seedCreatedAt: now,
      };

      // Execute all Redis operations in single Lua script
      const redisStart = performance.now();
      await this.executeSeedRotationLua(
        username,
        rotationId,
        updatedSeedData,
        rotationData,
      );
      const redisTime = performance.now() - redisStart;

      // Fire-and-forget database backup
      this.performDatabaseBackup(
        username,
        userSeed,
        updatedSeedData,
        rotationData,
        rotationId,
        newNextServerSeed,
      ).catch((err) => {
        this.logger.error(`Database backup failed for ${username}:`, err);
      });

      const totalTime = performance.now() - startTime;

      this.logger.log(
        `⚡ Seed rotated for ${username}: Redis=${redisTime.toFixed(2)}ms, Total=${totalTime.toFixed(2)}ms`,
      );

      return {
        newServerSeedHash: updatedSeedData.activeServerSeedHash,
        newClientSeed: updatedSeedData.activeClientSeed,
        nextServerSeedHash: updatedSeedData.nextServerSeedHash,
        oldServerSeed: userSeed.activeServerSeed,
        oldServerSeedHash: userSeed.activeServerSeedHash,
        gamesPlayed: 0,
        rotationId,
      };
    } finally {
      await this.releaseLock(lockKey, lockValue);
    }
  }

  /**
   * Check active games count using Lua (MODIFIED: List-based)
   */
private async checkActiveGamesLua(username: string): Promise<number> {
  const script = `
    local key = KEYS[1]

    if redis.call('EXISTS', key) == 0 then
      return -1
    end

    return redis.call('LLEN', key)
  `;

  const result = await this.redis.mainClient.eval(script, {
    keys: [RedisKeys.user.games.active(username)],
    arguments: [],
  });

  return Number(result);
}

  /**
   * Execute seed rotation Lua script
   */
  private async executeSeedRotationLua(
    username: string,
    rotationId: string,
    seedData: UserSeedData,
    rotationData: any,
  ): Promise<void> {
    const script = `
      local seedKey = KEYS[1]
      local rotationKey = KEYS[2]
      local rotationListKey = KEYS[3]
      local nonceKey = KEYS[4]
      
      local seedData = ARGV[1]
      local rotationData = ARGV[2]
      local rotationId = ARGV[3]
      local seedTTL = tonumber(ARGV[4])
      local rotationTTL = tonumber(ARGV[5])
      
      -- Update seed cache
      redis.call('SETEX', seedKey, seedTTL, seedData)
      
      -- Store rotation history
      redis.call('SETEX', rotationKey, rotationTTL, rotationData)
      
      -- Add to rotation list and trim to last 50
      redis.call('LPUSH', rotationListKey, rotationId)
      redis.call('LTRIM', rotationListKey, 0, 49)
      redis.call('EXPIRE', rotationListKey, seedTTL * 30)
      
      -- Reset nonce to 0
      redis.call('SET', nonceKey, '0', 'EX', seedTTL)
      
      return 'OK'
    `;

    await this.redis.mainClient.eval(script, {
      keys: [
        RedisKeys.user.userSeed(username),
        RedisKeys.user.seedRotationHistory(username, rotationId),
        RedisKeys.user.seedRotationHistoryList(username),
        RedisKeys.user.nonce(username),
      ],
      arguments: [
        JSON.stringify(seedData),
        JSON.stringify(rotationData),
        rotationId,
        this.CACHE_TTL.toString(),
        (this.CACHE_TTL * 7).toString(),
      ],
    });
  }

  /**
   * Perform database backup operations asynchronously
   */
  private async performDatabaseBackup(
    username: string,
    oldSeed: UserSeedData,
    newSeed: UserSeedData,
    rotationData: any,
    rotationId: string,
    newNextServerSeed: string,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Create rotation history
        await tx.seedRotationHistory.create({
          data: rotationData,
        });

        // Update user seed
        await tx.userSeed.update({
          where: { id: oldSeed.id },
          data: {
            activeServerSeed: oldSeed.nextServerSeed,
            activeServerSeedHash: oldSeed.nextServerSeedHash,
            activeClientSeed: newSeed.activeClientSeed,
            nextServerSeed: newNextServerSeed,
            nextServerSeedHash: newSeed.nextServerSeedHash,
            seedCreatedAt: newSeed.seedCreatedAt,
            seedRotatedAt: new Date(),
            totalGamesPlayed: 0,
          },
        });

        // Link games to rotation history
        await tx.gameHistory.updateMany({
          where: {
            username,
            seedRotationHistoryId: null,
          },
          data: {
            seedRotationHistoryId: rotationId,
          },
        });
      });

      this.logger.log(`✅ Database backup completed for ${username}`);
    } catch (error) {
      this.logger.error(`❌ Database backup failed for ${username}:`, error);
      await this.scheduleRetry(
        username,
        oldSeed,
        newSeed,
        rotationData,
        rotationId,
        newNextServerSeed,
      );
    }
  }

  /**
   * Schedule retry for failed database operations
   */
  private async scheduleRetry(
    username: string,
    oldSeed: UserSeedData,
    newSeed: UserSeedData,
    rotationData: any,
    rotationId: string,
    newNextServerSeed: string,
  ) {
    const retryKey = RedisKeys.user.seedRotationRetry(username, rotationId);

    await this.redis.mainClient.setEx(
      retryKey,
      3600,
      JSON.stringify({
        username,
        oldSeed,
        newSeed,
        rotationData,
        rotationId,
        newNextServerSeed,
        retryCount: 0,
        createdAt: new Date(),
      }),
    );

    this.logger.warn(`Scheduled retry for rotation ${rotationId}`);
  }

  /**
   * Change client seed only (triggers seed rotation)
   */
  async changeClientSeed(username: string, newClientSeed: string) {
    if (
      !newClientSeed ||
      newClientSeed.length < 8 ||
      newClientSeed.length > 64
    ) {
      throw new BadRequestException('Client seed must be 8-64 characters');
    }

    return await this.rotateSeed(username, newClientSeed, 'CLIENT_SEED_CHANGE');
  }

  /**
   * Get seed history - Redis first, DB fallback
   */
  async getSeedHistory(username: string, limit = 10) {
    const rotationListKey = RedisKeys.user.seedRotationHistoryList(username);
    const rotationIds = await this.redis.mainClient.lRange(
      rotationListKey,
      0,
      limit - 1,
    );

    if (rotationIds.length > 0) {
      const history: any[] = [];

      for (const rotationId of rotationIds) {
        const rotationKey = RedisKeys.user.seedRotationHistory(
          username,
          rotationId,
        );
        const data = await this.redis.get(rotationKey);

        if (data) {
          history.push({
            id: data.id,
            serverSeed: data.serverSeed,
            serverSeedHash: data.serverSeedHash,
            clientSeed: data.clientSeed,
            totalGamesPlayed: data.totalGamesPlayed,
            firstNonce: data.firstNonce,
            lastNonce: data.lastNonce,
            seedActivatedAt: data.seedActivatedAt,
            seedRotatedAt: data.seedRotatedAt,
            rotationType: data.rotationType,
          });
        }
      }

      if (history.length > 0) {
        return history;
      }
    }

    // Fallback to database
    return await this.prisma.seedRotationHistory.findMany({
      where: { userUsername: username },
      orderBy: { seedRotatedAt: 'desc' },
      take: limit,
    });
  }

  /* ============================================
     CACHE MANAGEMENT
  ============================================ */

  async invalidateUserCaches(username: string) {
    try {
      await Promise.all([
        this.redis.del(RedisKeys.user.userSeed(username)),
        this.redis.del(RedisKeys.user.nonce(username)),
      ]);

      this.logger.debug(`Caches invalidated for ${username}`);
    } catch (error) {
      this.logger.error(`Cache invalidation failed:`, error);
    }
  }

  async preloadSeedCache(username: string) {
    try {
      const seed = await this.getUserSeed(username);
      this.logger.debug(`Seed cache preloaded for ${username}`);
      return seed;
    } catch (error) {
      this.logger.error(`Cache preload failed:`, error);
      throw error;
    }
  }

  /**
   * Batch preload seeds for multiple users
   */
  async batchPreloadSeeds(usernames: string[]): Promise<void> {
    const BATCH_SIZE = 50;

    for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
      const batch = usernames.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(batch.map((username) => this.getUserSeed(username)));
    }

    this.logger.log(`Preloaded seeds for ${usernames.length} users`);
  }

  /* ============================================
     LOCK MANAGEMENT
  ============================================ */

  private async acquireLock(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      const result = await this.redis.mainClient.set(key, value, {
        EX: ttlSeconds,
        NX: true,
      });
      return result === 'OK';
    } catch (error) {
      this.logger.error(`Lock acquisition failed:`, error);
      return false;
    }
  }

  private async releaseLock(key: string, value: string): Promise<void> {
    try {
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      await this.redis.mainClient.eval(script, {
        keys: [key],
        arguments: [value],
      });
    } catch (error) {
      this.logger.error(`Lock release failed:`, error);
    }
  }

}