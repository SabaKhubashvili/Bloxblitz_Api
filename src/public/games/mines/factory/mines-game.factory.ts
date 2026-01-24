import {
  Injectable,
  BadRequestException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { MinesRepository } from '../repository/mines.repository';
import { RedisService } from 'src/provider/redis/redis.service';
import { SharedUserGamesService } from 'src/shared/user/games/shared-user-games.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { randomBytes } from 'crypto';
import { MinesCalculationService } from '../service/mines-calculation.service';
import { SeedManagementService } from '../../seed-managment/seed-managment.service';
import { MinesPersistenceService } from '../service/mines-persistence.service';
import { MinesGame } from '../types/mines.types';
import { GameOutcome } from '@prisma/client';

@Injectable()
export class MinesGameFactory {
  private readonly logger = new Logger(MinesGameFactory.name);
  private readonly CACHE_TTL = 86400; // 24 hours

  constructor(
    private readonly repo: MinesRepository,
    private readonly calculator: MinesCalculationService,
    private readonly seedManagement: SeedManagementService,
    private readonly redisService: RedisService,
    private readonly persistence: MinesPersistenceService,
    private readonly sharedUserGames: SharedUserGamesService,
  ) {}

  /**
   * OPTIMIZED: Create new Mines game with single Lua script
   * Reduces execution time from 50-100ms to 10-20ms
   */
  async createNewGame(
    betAmount: number,
    username: string,
    mines: number,
    size: 25 | 16,
  ): Promise<
    Omit<MinesGame, 'betId' | 'mineMask' | 'revealedMask' | 'serverSeed'>
  > {
    const overallStart = performance.now();
    const perfMetrics: Record<string, number> = {};
    const gameId = this.generateGameId();

    try {
      // ============================================
      // STEP 1: Single Lua script for all Redis operations
      // ============================================
      let stepStart = performance.now();

      const luaResult = await this.executeGameCreationLua(
        username,
        gameId,
        betAmount,
      );

      perfMetrics.luaScriptExecution = performance.now() - stepStart;

      // Handle different Lua script results
      if (luaResult.error) {
        if (luaResult.error === 'SEED_NOT_CACHED') {
          // Fallback to slower path with database lookup
          return await this.createNewGameSlowPath(
            betAmount,
            username,
            mines,
            size,
            gameId,
          );
        }
        throw this.handleCreationError(luaResult.error);
      }

      const { seedData, nonce } = luaResult;
      if (!seedData || !nonce) {
        throw new InternalServerErrorException('Invalid seed data ');
      }

      // ============================================
      // STEP 2: CPU-bound mine mask generation (no I/O)
      // ============================================
      stepStart = performance.now();
      const mineMask = this.calculator.generateMineMask(
        seedData.activeServerSeed,
        seedData.activeClientSeed,
        nonce,
        size,
        mines,
      );
      perfMetrics.generateMineMask = performance.now() - stepStart;

      // ============================================
      // STEP 3: Prepare game data
      // ============================================
      const gameData: MinesGame = {
        gameId,
        mines,
        mineMask,
        revealedMask: 0,
        revealedTiles: [],
        gemsLeft: size - mines,
        grid: size,
        betAmount,
        active: true,
        creatorUsername: username,
        serverSeed: seedData.activeServerSeed,
        serverSeedHash: seedData.activeServerSeedHash,
        clientSeed: seedData.activeClientSeed,
        nonce,
        multiplier: 1,
        outcome: GameOutcome.PLAYING,
      };

      // ============================================
      // STEP 4: Execute all remaining operations in parallel
      // ============================================
      stepStart = performance.now();

      const updateResult = await this.repo.updateGame(
        gameId,
        { mineMask, nonce },
        gameData,
      );

      // Sync nonce to database (async, non-blocking)
      (this.syncNonceToDatabase(username, nonce),
        // Backup game to persistent storage
        this.persistence
          .backupGame(gameId, username, gameData)
          .then((betId) => {
            this.repo.updateGame(gameId, { betId: betId }).catch((err) => {
              this.logger.error(
                `Failed to update betId for game ${gameId}:`,
                err,
              );
            });
          }),
        (perfMetrics.parallelOperations = performance.now() - stepStart));

      // Handle backup result (update betId if successful)

      const totalTime = performance.now() - overallStart;

      // Log performance metrics
      this.logger.log(
        `Game ${gameId} created in ${totalTime.toFixed(2)}ms:\n` +
          Object.entries(perfMetrics)
            .map(([key, time]) => `  ${key}: ${time.toFixed(2)}ms`)
            .join('\n'),
      );

      // Return response (without sensitive data)
      return {
        gameId,
        mines,
        revealedTiles: [],
        gemsLeft: size - mines,
        grid: size,
        betAmount,
        active: true,
        creatorUsername: username,
        serverSeedHash: seedData.activeServerSeedHash,
        clientSeed: seedData.activeClientSeed,
        nonce,
        multiplier: 1,
        outcome: 'PLAYING',
      };
    } catch (err) {
      // Cleanup on error
      await this.cleanupFailedGame(username, gameId);
      throw err;
    }
  }


  private async executeGameCreationLua(
    username: string,
    gameId: string,
    betAmount: number,
  ): Promise<
    | { seedData: any; nonce: number; error?: never }
    | { error: string; seedData?: never; nonce?: never }
  > {
    const luaScript = `
    local seedKey = KEYS[1]
    local nonceKey = KEYS[2]
    local balanceKey = KEYS[3]
    local gameKey = KEYS[4]
    local activeGamesKey = KEYS[5]
    local userActiveGameKey = KEYS[6]
    
    local betAmount = ARGV[1]  -- Keep as string initially
    local gameId = ARGV[2]
    local cacheTTL = tonumber(ARGV[3])
    local username = ARGV[4]
    
    local hasGame = redis.call('EXISTS', userActiveGameKey)
    if hasGame == 1 then
      return cjson.encode({error = 'GAME_EXISTS'})
    end

    -- Convert betAmount to number and validate
    local betAmountNum = tonumber(betAmount)
    if not betAmountNum or betAmountNum <= 0 then
      return cjson.encode({error = 'INVALID_BET_AMOUNT'})
    end
    
    
    -- 1. Check if seed exists in cache
    local seedData = redis.call('GET', seedKey)
    if not seedData then
      return cjson.encode({error = 'SEED_NOT_CACHED'})
    end
    
    -- 2. Check if game already exists
    local gameExists = redis.call('EXISTS', gameKey)
    if gameExists == 1 then
      return cjson.encode({error = 'GAME_EXISTS'})
    end
    
    -- 3. Get current balance
    local balanceStr = redis.call('GET', balanceKey)
    if not balanceStr then
      return cjson.encode({error = 'BALANCE_NOT_FOUND'})
    end
    
    local balance = tonumber(balanceStr)
    if not balance then
      return cjson.encode({error = 'INVALID_BALANCE_FORMAT'})
    end
    
    -- 4. Check sufficient balance
    if balance < betAmountNum then
      return cjson.encode({error = 'INSUFFICIENT_BALANCE'})
    end
    
    -- 5. Atomic nonce increment
    local nonce = redis.call('INCR', nonceKey)
    if nonce == 1 then
      redis.call('EXPIRE', nonceKey, cacheTTL)
    end

    
    -- 6. Deduct balance using INCRBYFLOAT for decimal precision
    -- This handles both integer and decimal amounts properly
    local newBalance = redis.call('INCRBYFLOAT', balanceKey, '-' .. betAmount)
     redis.call('SADD', 'user:balance:dirty', username)
    
    -- Verify the deduction worked
    if tonumber(newBalance) < 0 then
      -- Rollback: increment nonce back and restore balance
      redis.call('DECR', nonceKey)
      redis.call('INCRBYFLOAT', balanceKey, betAmount)
      return cjson.encode({error = 'BALANCE_DEDUCTION_FAILED'})
    end
    
    -- 7. Create game placeholder
    redis.call('SET', gameKey, 'CREATING', 'EX', 3600)

    redis.call('SET',userActiveGameKey, gameId, 'EX', 3600)
    local seedTable = cjson.decode(seedData)
    seedTable.totalGamesPlayed = (seedTable.totalGamesPlayed or 0) + 1
    local updatedSeedData = cjson.encode(seedTable)
    redis.call('SET', seedKey, updatedSeedData, 'EX', cacheTTL)
    -- 8. Add to active games
    local gameData = cjson.encode({gameId = gameId, gameType = 'MINES'})
    redis.call('LPUSH', activeGamesKey, gameData)

    
    -- Return success with seed data and nonce
    return cjson.encode({
      seedData = seedData,
      nonce = nonce
    })
  `;

    try {
      const result = await this.redisService.mainClient.eval(luaScript, {
        keys: [
          RedisKeys.user.userSeed(username),
          RedisKeys.user.nonce(username),
          RedisKeys.user.balance.user(username),
          RedisKeys.mines.game(gameId),
          RedisKeys.user.games.active(username),
          `user:mines:active:${username}`,
        ],
        arguments: [betAmount.toString(), gameId, this.CACHE_TTL.toString(), username],
      });

      const parsed = JSON.parse(result as string);

      if (parsed.error) {
        return { error: parsed.error };
      }

      return {
        seedData: JSON.parse(parsed.seedData),
        nonce: parsed.nonce,
      };
    } catch (error) {
      this.logger.error('Lua script execution failed:', error);
      throw new InternalServerErrorException('Game creation failed');
    }
  }

  /**
   * Fallback path when seed is not cached
   * This path is slower but ensures reliability
   */
  private async createNewGameSlowPath(
    betAmount: number,
    username: string,
    mines: number,
    size: 25 | 16,
    gameId: string,
  ): Promise<
    Omit<MinesGame, 'betId' | 'mineMask' | 'revealedMask' | 'serverSeed'>
  > {
    this.logger.warn(
      `Cache miss for ${username}, using slow path for game ${gameId}`,
    );

    const slowPathStart = performance.now();

    // Fetch seed from database and cache it
    const [userSeed, nonce] = await Promise.all([
      this.seedManagement.getUserSeed(username), // This will cache the seed
      this.seedManagement.getAndIncrementNonce(username, 'MINES'),
    ]);

    // Atomic balance check and game creation
    const newGameData = {
      gameId,
      mines,
      mineMask: 0,
      revealedTiles: [],
      gemsLeft: size - mines,
      grid: size,
      betAmount,
      revealedMask: 0,
      multiplier: 1,
      active: true,
      creatorUsername: username,
      serverSeed: userSeed.activeServerSeed,
      serverSeedHash: userSeed.activeServerSeedHash,
      clientSeed: userSeed.activeClientSeed,
      nonce,
    };

    const result = await this.redisService.atomicCreateMinesGame(
      username,
      betAmount,
      gameId,
      JSON.stringify(newGameData),
    );

    if (!result.success) {
      throw this.handleCreationError(result.error || '');
    }

    // Generate mine mask
    const mineMask = this.calculator.generateMineMask(
      userSeed.activeServerSeed,
      userSeed.activeClientSeed,
      nonce,
      size,
      mines,
    );

    const gameData: MinesGame = {
      gameId,
      mines,
      mineMask,
      revealedMask: 0,
      revealedTiles: [],
      gemsLeft: size - mines,
      grid: size,
      betAmount,
      active: true,
      creatorUsername: username,
      serverSeed: userSeed.activeServerSeed,
      serverSeedHash: userSeed.activeServerSeedHash,
      clientSeed: userSeed.activeClientSeed,
      nonce,
      multiplier: 1,
      outcome: GameOutcome.PLAYING,
    };

    // Execute remaining operations in parallel
    await Promise.allSettled([
      this.repo.updateGame(gameId, { mineMask, nonce }, gameData),
      this.sharedUserGames.addActiveGame(username, {
        gameType: 'MINES',
        gameId,
      }),
      this.persistence.backupGame(gameId, username, gameData).then((betId) => {
        if (betId) {
          return this.repo.updateGame(gameId, { betId });
        }
      }),
    ]);

    const slowPathTime = performance.now() - slowPathStart;
    this.logger.log(
      `Slow path completed for ${gameId} in ${slowPathTime.toFixed(2)}ms`,
    );

    return {
      gameId,
      mines,
      revealedTiles: [],
      gemsLeft: size - mines,
      grid: size,
      betAmount,
      active: true,
      creatorUsername: username,
      serverSeedHash: userSeed.activeServerSeedHash,
      clientSeed: userSeed.activeClientSeed,
      nonce,
      multiplier: 1,
      outcome: 'PLAYING',
    };
  }

  /**
   * Sync nonce to database (fire-and-forget)
   */
  private async syncNonceToDatabase(
    username: string,
    nonce: number,
  ): Promise<void> {
    try {
      // This runs async and doesn't block the response
      await this.seedManagement.syncNonceToDatabase(username, nonce);
    } catch (error) {
      this.logger.error(`Nonce sync failed for ${username}:`, error);
      // Don't throw - this is fire-and-forget
    }
  }

  /**
   * Cleanup failed game creation
   */
  private async cleanupFailedGame(
    username: string,
    gameId: string,
  ): Promise<void> {
    await Promise.allSettled([
      this.sharedUserGames.removeActiveGame(username, gameId),
      this.redisService.del(RedisKeys.mines.game(gameId)),
    ]);

    this.logger.warn(`Cleaned up failed game ${gameId} for ${username}`);
  }

  /**
   * Generate unique game ID
   */
  private generateGameId(): string {
    return `mines_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Handle creation errors with appropriate exceptions
   */
  private handleCreationError(error: string): Error {
    switch (error) {
      case 'INSUFFICIENT_BALANCE':
        return new BadRequestException('Insufficient balance');
      case 'GAME_EXISTS':
        return new BadRequestException('Game already exists');
      case 'SEED_NOT_CACHED':
        return new InternalServerErrorException('Seed not available');
      default:
        return new InternalServerErrorException(
          `Game creation failed: ${error}`,
        );
    }
  }

  /**
   * Warmup cache for user (call this on login)
   */
  async warmupUserCache(username: string): Promise<void> {
    try {
      await this.seedManagement.preloadSeedCache(username);
      this.logger.debug(`Cache warmed up for ${username}`);
    } catch (error) {
      this.logger.error(`Cache warmup failed for ${username}:`, error);
    }
  }

  /**
   * Batch warmup for multiple users
   */
  async batchWarmupCache(usernames: string[]): Promise<void> {
    const BATCH_SIZE = 50;

    for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
      const batch = usernames.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map((username) => this.warmupUserCache(username)),
      );
    }

    this.logger.log(`Warmed up cache for ${usernames.length} users`);
  }
}
