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
import { UserRepository } from 'src/public/modules/user/user.repository';

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
    private readonly userRepository: UserRepository,
  ) {}

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
      const lockMines = await this.repo.lockMinesGame(gameId);
      if (!lockMines) {
        throw new InternalServerErrorException('Could not acquire game lock');
      }
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
        status: 'PLAYING',
      };

      // ============================================
      // STEP 4: Execute all remaining operations in parallel
      // ============================================
      stepStart = performance.now();
      this.logger.log(`Updating game ${gameId} with mineMask and nonce`);
      await this.repo.updateGame(gameId, { mineMask, nonce }, gameData);
      console.log(await this.redisService.get(RedisKeys.mines.game(gameId)));

      // Sync nonce to database (async, non-blocking)
      (this.syncNonceToDatabase(username, nonce),
        // Backup game to persistent storage
        await this.persistence
          .backupGame(gameId, username, gameData)
          .then((betId) => {
            this.repo
              .updateGame(gameId, { betId: betId }, gameData)
              .catch((err) => {
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
      await this.cleanupFailedGame(username, gameId, betAmount);
      throw err;
    } finally {
      await this.repo.unlockMinesGame(gameId);
    }
  }

  private async executeGameCreationLua(
    username: string,
    gameId: string,
    betAmount: number,
    seedData?: any,
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
    local seedDataArg = ARGV[5]

    -- Check if user already has an active game
    
    local hasGame = redis.call('EXISTS', userActiveGameKey)
    if hasGame == 1 then
      return cjson.encode({error = 'GAME_EXISTS'})
    end

    -- Convert betAmount to number and validate
    local betAmountNum = tonumber(betAmount)
    if not betAmountNum or betAmountNum <= 0 then
      return cjson.encode({error = 'INVALID_BET_AMOUNT'})
    end
    
    local seedData = nil
    local seedTable = nil
    
    -- 1. Check if seed exists in cache
    if seedDataArg ~= '' then
      seedData = seedDataArg
      seedTable = cjson.decode(seedDataArg)
    else
      seedData = redis.call('GET', seedKey)
      if not seedData then
        return cjson.encode({error = 'SEED_NOT_CACHED'})
      end
      seedTable = cjson.decode(seedData)
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
    local currentBalance = tonumber(redis.call('GET', balanceKey)) or 0
    local newBalance = currentBalance - tonumber(betAmount)
    newBalance = tonumber(string.format("%.2f", newBalance))
    if newBalance < 0 then
      -- Rollback: increment nonce back
      redis.call('DECR', nonceKey)
      return cjson.encode({error = 'BALANCE_DEDUCTION_FAILED'})
    end

    redis.call('SET', balanceKey, newBalance)

    -- Mark user balance as dirty
    redis.call('SADD', 'user:balance:dirty', username)
        
    -- 7. Create game placeholder
    redis.call('SET', gameKey, '{"status":"INITIALIZING"}')
    redis.call('SET',userActiveGameKey, gameId)

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
        arguments: [
          betAmount.toString(),
          gameId,
          this.CACHE_TTL.toString(),
          username,
          seedData ? JSON.stringify(seedData) : '',
        ],
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
    let balanceDeducted = false;
    try {
      this.logger.warn(
        `Cache miss for ${username}, using slow path for game ${gameId}`,
      );
      const seedData = await this.seedManagement.getUserSeed(username);
      if (!seedData) {
        throw new InternalServerErrorException('Could not retrieve seed data');
      }

      // ============================================
      // STEP 2: Execute Lua script for atomic Redis operations
      // ============================================
      const luaResult = await this.executeGameCreationLua(
        username,
        gameId,
        betAmount,
        seedData
      );

      // Handle Lua script errors
      if (luaResult.error) {
        throw this.handleCreationError(luaResult.error);
      }
      balanceDeducted = true;

      const { nonce } = luaResult;
      if (!nonce) {
        throw new InternalServerErrorException('Invalid seed data');
      }

      // ============================================
      // STEP 3: CPU-bound mine mask generation (no I/O)
      // ============================================
      const mineMask = this.calculator.generateMineMask(
        seedData.activeServerSeed,
        seedData.activeClientSeed,
        nonce,
        size,
        mines,
      );

      // ============================================
      // STEP 4: Prepare game data
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
        status: 'PLAYING',
      };

      // ============================================
      // STEP 5: Execute all remaining operations in parallel
      // ============================================
      await this.repo
        .updateGame(gameId, { mineMask, nonce }, gameData)
        .catch(async (err) => {
          this.logger.error(`Failed to update game ${gameId} in Redis:`, err);
          await this.cleanupFailedGame(username, gameId, betAmount);
          throw new InternalServerErrorException('Game creation failed');
        });

      // Sync nonce to database and backup game (async, non-blocking)

      (this.syncNonceToDatabase(username, nonce),
        await this.persistence
          .backupGame(gameId, username, gameData)
          .then(async (betId) => {
            if (betId) {
              await this.repo.updateGame(gameId, { betId }, gameData).catch((err) => {
                this.logger.error(
                  `Failed to update betId for game ${gameId}:`,
                  err,
                );
              });
            }
          }));

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
      this.logger.error(`Slow path failed for game ${gameId}:`, err);
      await this.cleanupFailedGame(username, gameId, betAmount,balanceDeducted);
      throw err;
    }
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
    betAmount: number,
    balanceDeducted?:boolean,
  ): Promise<void> {
    if (balanceDeducted) {
      await this.userRepository.incrementUserBalance(username, betAmount);
    }
    await Promise.allSettled([
      this.sharedUserGames.removeActiveGame(username, gameId),
      this.redisService.del(RedisKeys.mines.game(gameId)),
      this.redisService.del(`user:mines:active:${username}`),
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