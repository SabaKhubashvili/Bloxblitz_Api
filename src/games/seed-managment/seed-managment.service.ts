import {
  Injectable,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { OfflineGameType } from '@prisma/client';
import { RedisService } from 'src/provider/redis/redis.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';

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

interface NonceData {
  currentNonce: number;
}

@Injectable()
export class SeedManagementService implements OnModuleInit {
  private readonly logger = new Logger(SeedManagementService.name);

  // Redis key patterns
  private readonly SEED_KEY_PREFIX = RedisKeys.user.userSeed;
  private readonly NONCE_KEY_PREFIX = RedisKeys.user.nonce;
  private readonly SEED_LOCK_PREFIX = RedisKeys.user.lockSeed;

  // Cache TTL (24 hours)
  private readonly CACHE_TTL = 86400;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit() {
    this.logger.log('SeedManagementService initialized');
  }

  /* ============================================
     CORE SEED OPERATIONS
  ============================================ */

  /**
   * Get user's seed data with Redis caching
   * Attempts Redis first, falls back to PostgreSQL
   */
  async getUserSeed(username: string): Promise<UserSeedData> {
    const cacheKey = RedisKeys.user.userSeed(username);

    try {
      // Try Redis cache first
      this.logger.debug(
        `Attempting to get seed from Redis with key: ${cacheKey}`,
      );
      const cached = await this.redis.mainClient.get(cacheKey);

      if (cached) {
        this.logger.debug(`Seed cache HIT for ${username}`);
        return JSON.parse(cached);
      }

      this.logger.debug(`Seed cache MISS for ${username} - key: ${cacheKey}`);

      // Cache miss - fetch from database
      let userSeed = await this.prisma.userSeed.findUnique({
        where: { userUsername: username },
      });

      // Create if doesn't exist
      if (!userSeed) {
        this.logger.debug(`Creating new seed for ${username}`);
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

      // Cache for future requests
      this.logger.debug(
        `Setting cache for ${username} with key: ${cacheKey}, TTL: ${this.CACHE_TTL}s`,
      );
      const response = await this.redis.mainClient.setEx(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(seedData),
      );

      this.logger.debug(`Redis setEx response: ${response}`);

      // Verify it was actually set
      const verification = await this.redis.mainClient.get(cacheKey);
      this.logger.debug(
        `Cache verification for ${username}: ${verification ? 'EXISTS' : 'NOT FOUND'}`,
      );

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

    return {
      serverSeedHash: seed.activeServerSeedHash,
      clientSeed: seed.activeClientSeed,
      nextServerSeedHash: seed.nextServerSeedHash,
      totalGamesPlayed: seed.totalGamesPlayed,
      maxGamesPerSeed: seed.maxGamesPerSeed,
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

    return await this.prisma.userSeed.create({
      data: {
        userUsername: username,
        activeServerSeed,
        activeServerSeedHash,
        activeClientSeed,
        nextServerSeed,
        nextServerSeedHash,
      },
    });
  }

  /* ============================================
     NONCE MANAGEMENT
  ============================================ */

  /**
   * Get and increment nonce atomically using Redis
   * Falls back to database if Redis fails
   */
  async getAndIncrementNonce(
    username: string,
    gameType: OfflineGameType,
  ): Promise<number> {
    const nonceKey = RedisKeys.user.nonce(username);

    try {
      // Try atomic increment in Redis
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
      return await this.getDatabaseNonce(username, gameType);
    }
  }

  /**
   * Get current nonce without incrementing
   */
  async getCurrentNonce(
    username: string,
    gameType: OfflineGameType,
  ): Promise<number> {
    const nonceKey = RedisKeys.user.nonce(username);

    try {
      const nonce = await this.redis.get(nonceKey);
      if (nonce) {
        return parseInt(nonce, 10);
      }

      // Fetch from database
      const seed = await this.getUserSeed(username);
      const dbNonce = await this.prisma.userSeed.findUnique({
        where: {
          userUsername: username,
        },
      });

      const currentNonce = dbNonce?.totalGamesPlayed || 0;

      // Cache it
      await this.redis.mainClient.setEx(
        nonceKey,
        this.CACHE_TTL,
        currentNonce.toString(),
      );

      return currentNonce;
    } catch (error) {
      this.logger.error(`Error getting nonce:`, error);
      throw error;
    }
  }

  /**
   * Database fallback for nonce increment
   */
  private async getDatabaseNonce(
    username: string,
    gameType: OfflineGameType,
  ): Promise<number> {
    const seed = await this.getUserSeed(username);

    const nonce = await this.prisma.userSeed.update({
      where: {
        userUsername: username,
      },
      data: {
        totalGamesPlayed: { increment: 1 },
      },
    });

    // Update cache
    const nonceKey = RedisKeys.user.nonce(username);
    await this.redis.mainClient.setEx(
      nonceKey,
      this.CACHE_TTL,
      nonce.totalGamesPlayed.toString(),
    );

    return nonce.totalGamesPlayed;
  }

  /**
   * Sync Redis nonce to database periodically
   */
  private async syncNonceToDatabase(
    username: string,
    nonce: number,
  ): Promise<void> {
    try {
      const seed = await this.getUserSeed(username);

      await this.prisma.userSeed.update({
        where: {
          id: seed.id,
        },
        data: {
          totalGamesPlayed: nonce,
        },
      });
    } catch (error) {
      // Silent fail - not critical
    }
  }

  /* ============================================
     SEED ROTATION
  ============================================ */

  
async rotateSeed(
  username: string,
  newClientSeed?: string,
  rotationType: 'MANUAL' | 'AUTOMATIC' | 'CLIENT_SEED_CHANGE' = 'MANUAL',
) {
  const startTime = performance.now();
  const lockKey = RedisKeys.user.lockSeed(username);
  const lockValue = randomBytes(16).toString('hex');

  try {
    // Acquire distributed lock (10 second timeout)
    const lockStart = performance.now();
    const locked = await this.acquireLock(lockKey, lockValue, 10);
    const lockTime = performance.now() - lockStart;

    if (!locked) {
      throw new BadRequestException('Seed rotation already in progress');
    }

    // 1️⃣ Get current seed from cache (fast)
    const cacheStart = performance.now();
    const userSeed = await this.getUserSeed(username);
    const cacheTime = performance.now() - cacheStart;

    // 2️⃣ Generate new seeds (CPU-bound, no I/O)
    const seedGenStart = performance.now();
    const newNextServerSeed = randomBytes(32).toString('hex');
    const newNextServerSeedHash = createHash('sha256')
      .update(newNextServerSeed)
      .digest('hex');
    const rotationId = randomBytes(16).toString('hex');
    const seedGenTime = performance.now() - seedGenStart;

    // 3️⃣ Prepare all data (no I/O)
    const prepStart = performance.now();
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
    const prepTime = performance.now() - prepStart;

    // 4️⃣ Execute ALL Redis operations in parallel
    const redisStart = performance.now();
    const cacheKey = RedisKeys.user.userSeed(username);
    const rotationKey = RedisKeys.user.seedRotationHistory(username, rotationId);
    const rotationListKey = RedisKeys.user.seedRotationHistoryList(username);

    await Promise.all([
      // Update user seed cache
      this.redis.mainClient.setEx(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(updatedSeedData),
      ),
      // Store rotation history
      this.redis.mainClient.setEx(
        rotationKey,
        this.CACHE_TTL * 7,
        JSON.stringify(rotationData),
      ),
      // Add to rotation list
      this.redis.mainClient.lPush(rotationListKey, rotationId),
      // Trim rotation list
      this.redis.mainClient.lTrim(rotationListKey, 0, 49),
      // Set expiry on rotation list
      this.redis.mainClient.expire(rotationListKey, this.CACHE_TTL * 30),
    ]);
    const redisTime = performance.now() - redisStart;

    // 5️⃣ Fire-and-forget database backup (NO AWAIT)
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
      `⚡ Seed rotated for ${username} (Redis-first), revealed ${userSeed.activeServerSeed.substring(0, 8)}...`,
    );

    this.logger.debug(
      `Performance: Lock=${lockTime.toFixed(2)}ms, Cache=${cacheTime.toFixed(2)}ms, ` +
      `SeedGen=${seedGenTime.toFixed(2)}ms, Prep=${prepTime.toFixed(2)}ms, ` +
      `Redis=${redisTime.toFixed(2)}ms, Total=${totalTime.toFixed(2)}ms`
    );

    // Return immediately with data from memory
    return {
      newServerSeedHash: updatedSeedData.activeServerSeedHash,
      newClientSeed: updatedSeedData.activeClientSeed,
      nextServerSeedHash: updatedSeedData.nextServerSeedHash,
      oldServerSeed: userSeed.activeServerSeed,
      oldServerSeedHash: userSeed.activeServerSeedHash,
      gamesPlayed: 0,
      rotationId: rotationId,
    };
  } finally {
    // Always release lock
    await this.releaseLock(lockKey, lockValue);
  }
}
  /**
   * Perform database backup operations asynchronously
   * This runs in the background and doesn't block the response
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
      // Use a transaction for consistency
      await this.prisma.$transaction(async (tx) => {
        // 1️⃣ Create rotation history
        await tx.seedRotationHistory.create({
          data: rotationData,
        });

        // 2️⃣ Update user seed
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

        // 3️⃣ Link games to rotation history
        await tx.gameHistory.updateMany({
          where: {
            userUsername: username,
            serverSeedHash: oldSeed.activeServerSeedHash,
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

      // Implement retry logic
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
      3600, // 1 hour TTL
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

    // Could trigger a background job to process retries
    this.logger.warn(`Scheduled retry for rotation ${rotationId}`);
  }

  /**
   * Change client seed only (triggers seed rotation)
   */
  async changeClientSeed(username: string, newClientSeed: string) {
    // Validate client seed format
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
    const rotationListKey = `${RedisKeys.user.seedRotationHistory}${username}:list`;
    const rotationIds = await this.redis.mainClient.lRange(
      rotationListKey,
      0,
      limit - 1,
    );

    if (rotationIds.length > 0) {
      const history: any[] = [];

      for (const rotationId of rotationIds) {
        const rotationKey = `${RedisKeys.user.seedRotationHistory}${username}:${rotationId}`;
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
            rotationReason: data.rotationReason,
          });
        }
      }

      if (history.length > 0) {
        return history;
      }
    }
  }
  /* ============================================
     USAGE TRACKING
  ============================================ */

  async updateSeedUsage(username: string) {
    try {
      const seed = await this.getUserSeed(username);

      await this.prisma.userSeed.update({
        where: { id: seed.id },
        data: {
          lastUsedAt: new Date(),
          totalGamesPlayed: { increment: 1 },
        },
      });

      seed.totalGamesPlayed += 1;
      const cacheKey = RedisKeys.user.userSeed(username);
      await this.redis.mainClient.setEx(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(seed),
      );

      if (seed.totalGamesPlayed >= seed.maxGamesPerSeed) {
        this.logger.warn(`Auto-rotation triggered for ${username}`);
        this.rotateSeed(username, undefined, 'AUTOMATIC').catch((err) => {
          this.logger.error(`Auto-rotation failed:`, err);
        });
      }
    } catch (error) {
      this.logger.error(`Failed to update seed usage:`, error);
    }
  }
  /* ============================================
     CACHE MANAGEMENT
  ============================================ */

  async invalidateUserCaches(username: string) {
    try {
      await this.redis.del(RedisKeys.user.userSeed(username));

      const gameTypes: OfflineGameType[] = [
        'MINES',
        'DICE',
        'PLINKO',
        'WHEEL',
        'LIMBO',
        'KENO',
        'HILO',
        'TOWER',
      ];

      for (const gameType of gameTypes) {
        await this.redis.del(RedisKeys.user.nonce(username));
      }

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
  /* ============================================
     VERIFICATION & GAME HISTORY
  ============================================ */

  async verifyGameResult(
    username: string,
    serverSeedHash: string,
    clientSeed: string,
    nonce: number,
  ): Promise<{ valid: boolean; serverSeed?: string; canVerify: boolean }> {
    const currentSeed = await this.getUserSeed(username);
    if (currentSeed.activeServerSeedHash === serverSeedHash) {
      return {
        valid: true,
        canVerify: false,
        serverSeed: undefined,
      };
    }

    const rotationListKey = `${RedisKeys.user.seedRotationHistory}${username}:list`;
    const rotationIds = await this.redis.mainClient.lRange(
      rotationListKey,
      0,
      -1,
    );

    for (const rotationId of rotationIds) {
      const rotationKey = `${RedisKeys.user.seedRotationHistory}${username}:${rotationId}`;
      const rotationData = await this.redis.get(rotationKey);

      if (
        rotationData &&
        rotationData.serverSeedHash === serverSeedHash &&
        rotationData.clientSeed === clientSeed
      ) {
        const nonceInRange =
          nonce >= rotationData.firstNonce && nonce <= rotationData.lastNonce;

        return {
          valid: nonceInRange,
          canVerify: true,
          serverSeed: rotationData.serverSeed,
        };
      }
    }

    const history = await this.prisma.seedRotationHistory.findFirst({
      where: {
        userUsername: username,
        serverSeedHash,
        clientSeed,
      },
    });

    if (history) {
      const rotationKey = `${RedisKeys.user.seedRotationHistory}${username}:${history.id}`;
      this.redis.mainClient
        .setEx(rotationKey, this.CACHE_TTL * 7, JSON.stringify(history))
        .catch(() => {});

      const nonceInRange =
        nonce >= history.firstNonce && nonce <= history.lastNonce;
      return {
        valid: nonceInRange,
        canVerify: true,
        serverSeed: history.serverSeed,
      };
    }

    return {
      valid: false,
      canVerify: false,
    };
  }

  async getGamesForSeedRotation(username: string, rotationId: string) {
    return await this.prisma.gameHistory.findMany({
      where: {
        userUsername: username,
        seedRotationHistoryId: rotationId,
      },
      orderBy: {
        nonce: 'asc',
      },
      select: {
        gameId: true,
        gameType: true,
        nonce: true,
        betAmount: true,
        finalMultiplier: true,
        payout: true,
        profit: true,
        outcome: true,
        startedAt: true,
        completedAt: true,
      },
    });
  }

  async getUnverifiedGames(username: string) {
    const currentSeed = await this.getUserSeed(username);

    return await this.prisma.gameHistory.findMany({
      where: {
        userUsername: username,
        serverSeedHash: currentSeed.activeServerSeedHash,
        seedRotationHistoryId: null,
      },
      orderBy: {
        nonce: 'asc',
      },
      select: {
        gameId: true,
        gameType: true,
        nonce: true,
        serverSeedHash: true,
        clientSeed: true,
        betAmount: true,
        outcome: true,
        startedAt: true,
      },
    });
  }

  async getSeedDashboard(username: string) {
    const seed = await this.getUserSeed(username);
    const history = await this.getSeedHistory(username, 5);

    const unverifiedGames = await this.prisma.gameHistory.count({
      where: {
        userUsername: username,
        seedRotationHistoryId: null,
      },
    });

    const verifiedGames = await this.prisma.gameHistory.count({
      where: {
        userUsername: username,
        seedRotationHistoryId: { not: null },
      },
    });

    const nonces: Record<string, number> = {};
    const gameTypes: OfflineGameType[] = [
      'MINES',
      'DICE',
      'PLINKO',
      'WHEEL',
      'LIMBO',
      'KENO',
      'HILO',
      'TOWER',
    ];

    for (const gameType of gameTypes) {
      nonces[gameType] = await this.getCurrentNonce(username, gameType);
    }

    return {
      activeSeed: {
        serverSeedHash: seed.activeServerSeedHash,
        clientSeed: seed.activeClientSeed,
        nextServerSeedHash: seed.nextServerSeedHash,
        totalGamesPlayed: seed.totalGamesPlayed,
        maxGamesPerSeed: seed.maxGamesPerSeed,
        seedCreatedAt: seed.seedCreatedAt,
        progressPercentage:
          (seed.totalGamesPlayed / seed.maxGamesPerSeed) * 100,
      },
      stats: {
        unverifiedGames,
        verifiedGames,
        totalGames: unverifiedGames + verifiedGames,
      },
      nonces,
      recentHistory: history?.map((h) => ({
        ...h,
        gamesPlayed: h.totalGamesPlayed,
        nonceRange: `${h.firstNonce}-${h.lastNonce}`,
      })),
    };
  }
}
