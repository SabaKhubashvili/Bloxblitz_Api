import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { createClient } from 'redis';
import type { RedisArgument, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  mainClient: RedisClientType;
  private connecting = false;

  onModuleInit() {
    
    this.mainClient = createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => {
          this.logger.warn(`🔁 Redis reconnect attempt #${retries}`);
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.mainClient.on('error', (err) =>
      this.logger.error('❌ Redis error', err),
    );

    this.mainClient.on('ready', () => {
      this.logger.log('✅ Redis ready');
    });

    this.mainClient.on('end', () => {
      this.logger.warn('⚠️ Redis disconnected');
    });

    this.connectInBackground();
  }

  private async connectInBackground() {
    if (this.connecting) return;
    this.connecting = true;

    while (true) {
      try {
        if (!this.mainClient.isOpen) {
          await this.mainClient.connect();
        }
        return;
      } catch (err) {
        this.logger.error('⚠️ Redis connection failed, retrying...', err);
        await new Promise((res) => setTimeout(res, 2000));
      }
    }
  }

  async onModuleDestroy() {
    await this.mainClient.quit();
  }

  /* ---------------- BASIC OPS ---------------- */

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const data = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttlSeconds) {
      await this.mainClient.set(key, data, { EX: ttlSeconds });
    } else {
      await this.mainClient.set(key, data);
    }
  }

  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.mainClient.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value as T;
    }
  }

  async del(key: string): Promise<boolean> {
    return (await this.mainClient.del(key)) === 1;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.mainClient.exists(key)) === 1;
  }

  /* ---------------- LOCK OPS ---------------- */

  async lock(key: string, ttlMs: number): Promise<boolean> {
    const result = await this.mainClient.set(key, '1', {
      NX: true,
      PX: ttlMs,
    });
    return result === 'OK';
  }

  async unlock(key: string): Promise<boolean> {
    return (await this.mainClient.del(key)) === 1;
  }

  /* ---------------- COUNTER OPS ---------------- */

  async incr(key: string): Promise<number> {
    return this.mainClient.incr(key);
  }

  async getNumber(key: string): Promise<number | null> {
    const val = await this.mainClient.get(key);
    return val ? Number(val) : null;
  }

  async incrByFloat(key: string, increment: number): Promise<string> {
    return this.mainClient.incrByFloat(key, increment);
  }

  async decrBy(key: string, decrement: number): Promise<number> {
    return this.mainClient.decrBy(key, decrement);
  }

  /* ---------------- SET OPS ---------------- */

  async sadd(key: string, ...members: string[]): Promise<number> {
    return this.mainClient.sAdd(key, members);
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    return this.mainClient.sRem(key, members);
  }

  async smembers(key: string): Promise<string[]> {
    return this.mainClient.sMembers(key);
  }

  async sismember(key: string, member: string): Promise<number> {
    return this.mainClient.sIsMember(key, member);
  }

  async scard(key: string): Promise<number> {
    return this.mainClient.sCard(key);
  }

  /* ---------------- ATOMIC OPERATIONS ---------------- */

  async atomicUpdateIfMatch(
    key: string,
    conditionField: string,
    conditionValue: any,
    updates: Record<string, any>,
  ): Promise<boolean> {
    const luaScript = `
      local key = KEYS[1]
      local data = redis.call('GET', key)
      
      if not data then
        return 0
      end
      
      local obj = cjson.decode(data)
      local condField = ARGV[1]
      local condValue = ARGV[2]
      
      -- Check condition
      local actualValue = obj[condField]
      if type(actualValue) == "boolean" then
        actualValue = tostring(actualValue)
      else
        actualValue = tostring(actualValue)
      end
      
      if actualValue ~= condValue then
        return 0
      end
      
      -- Apply updates (ARGV[3] onwards, in pairs)
      local i = 3
      while i < #ARGV do
        local updateKey = ARGV[i]
        local updateValue = ARGV[i + 1]
        
        -- Handle boolean conversion
        if updateValue == "true" then
          obj[updateKey] = true
        elseif updateValue == "false" then
          obj[updateKey] = false
        elseif tonumber(updateValue) then
          obj[updateKey] = tonumber(updateValue)
        else
          obj[updateKey] = updateValue
        end
        
        i = i + 2
      end
      
      redis.call('SET', key, cjson.encode(obj))
      return 1
    `;

    const args = [conditionField, String(conditionValue)];

    for (const [updateKey, updateValue] of Object.entries(updates)) {
      args.push(updateKey);
      args.push(String(updateValue));
    }

    try {
      const result = await this.mainClient.eval(luaScript, {
        keys: [key],
        arguments: args,
      });

      return result === 1;
    } catch (error) {
      this.logger.error('Atomic update failed', error);
      return false;
    }
  }

  async atomicRevealTile(
    key: string,
    tileBit: number,
    tileIndex: number,
    updates: Record<string, any>,
  ): Promise<boolean> {
    const luaScript = `
      local key = KEYS[1]
      local tileBit = tonumber(ARGV[1])
      local tileIndex = tonumber(ARGV[2])
      
      local data = redis.call('GET', key)
      if not data then
        return 0
      end
      
      local obj = cjson.decode(data)
      
      -- Check if game is still active
      if obj.active ~= true then
        return 0
      end
      
      -- Check if tile already revealed (bitwise AND)
      local currentMask = tonumber(obj.revealedMask) or 0
      if bit.band(currentMask, tileBit) ~= 0 then
        return 0  -- Tile already revealed
      end
      
      -- Apply bitwise OR to reveal the tile
      obj.revealedMask = bit.bor(currentMask, tileBit)
      
      -- Atomically append to revealedTiles array
      if not obj.revealedTiles then
        obj.revealedTiles = {}
      end
      table.insert(obj.revealedTiles, tileIndex)
      
      -- Apply other updates (ARGV[3] onwards, in pairs)
      local i = 3
      while i < #ARGV do
        local updateKey = ARGV[i]
        local updateValue = ARGV[i + 1]
        
        -- Handle type conversion (skip revealedTiles as it's handled above)
        if updateKey ~= "revealedTiles" then
          if updateValue == "true" then
            obj[updateKey] = true
          elseif updateValue == "false" then
            obj[updateKey] = false
          elseif tonumber(updateValue) then
            obj[updateKey] = tonumber(updateValue)
          else
            obj[updateKey] = updateValue
          end
        end
        
        i = i + 2
      end
      
      redis.call('SET', key, cjson.encode(obj))
      return 1
    `;

    const args = [String(tileBit), String(tileIndex)];

    for (const [updateKey, updateValue] of Object.entries(updates)) {
      if (updateKey !== 'revealedTiles') {
        args.push(updateKey);
        args.push(String(updateValue));
      }
    }

    try {
      const result = await this.mainClient.eval(luaScript, {
        keys: [key],
        arguments: args,
      });
      return result === 1;
    } catch (error) {
      this.logger.error('Atomic tile reveal failed', error);
      return false;
    }
  }

  async atomicUpdateIfMultiMatch(
    key: string,
    conditions: Record<string, any>,
    updates: Record<string, any>,
  ): Promise<boolean> {
    const luaScript = `
      local key = KEYS[1]
      local data = redis.call('GET', key)
      if not data then
        return 0
      end
      
      local obj = cjson.decode(data)
      
      -- Check ALL conditions (ARGV contains condition pairs, then update pairs)
      local numConditions = tonumber(ARGV[1])
      local condIndex = 2
      
      for i = 1, numConditions do
        local condField = ARGV[condIndex]
        local condValue = ARGV[condIndex + 1]
        condIndex = condIndex + 2
        
        local actualValue = obj[condField]
        
        -- Type conversion
        if type(actualValue) == "boolean" then
          actualValue = tostring(actualValue)
        elseif type(actualValue) == "number" then
          actualValue = tostring(actualValue)
        else
          actualValue = tostring(actualValue)
        end
        
        -- If ANY condition fails, abort
        if actualValue ~= condValue then
          return 0
        end
      end
      
      -- All conditions passed, apply updates
      local updateIndex = condIndex
      while updateIndex < #ARGV do
        local updateKey = ARGV[updateIndex]
        local updateValue = ARGV[updateIndex + 1]
        
        -- Handle type conversion
        if updateValue == "true" then
          obj[updateKey] = true
        elseif updateValue == "false" then
          obj[updateKey] = false
        elseif tonumber(updateValue) then
          obj[updateKey] = tonumber(updateValue)
        else
          obj[updateKey] = updateValue
        end
        
        updateIndex = updateIndex + 2
      end
      
      redis.call('SET', key, cjson.encode(obj))
      return 1
    `;

    const args = [String(Object.keys(conditions).length)];

    for (const [condKey, condValue] of Object.entries(conditions)) {
      args.push(condKey);
      args.push(String(condValue));
    }

    for (const [updateKey, updateValue] of Object.entries(updates)) {
      args.push(updateKey);
      args.push(String(updateValue));
    }

    try {
      const result = await this.mainClient.eval(luaScript, {
        keys: [key],
        arguments: args,
      });
      return result === 1;
    } catch (error) {
      this.logger.error('Atomic multi-condition update failed', error);
      return false;
    }
  }

  /* ---------------- OPTIMIZED GAME OPERATIONS ---------------- */

  /**
   * ATOMIC GAME CREATION
   * Single Lua script handles EVERYTHING:
   * - Check active game
   * - Check balance
   * - Decrement balance
   * - Increment nonce
   * - Save game
   * - Update indices
   * Target: <100ms
   */
  async atomicCreateMinesGame(
    username: string,
    betAmount: number,
    gameId: string,
    gameDataWithoutNonce: string, // JSON string without nonce field set
  ): Promise<{
    success: boolean;
    nonce?: number;
    balance?: number;
    error?: string;
  }> {
    const luaScript = `
    local username = ARGV[1]
    local betAmount = tonumber(ARGV[2])
    local gameId = ARGV[3]
    local gameDataStr = ARGV[4]
    
    -- 1. Check for active game (FASTEST CHECK FIRST)
    local activeGame = redis.call('GET', 'user:mines:active:' .. username)
    if activeGame then
      return {0, 'ACTIVE_GAME_EXISTS'}
    end
    
    -- 2. Check balance
    local balanceKey = 'user:balance:' .. username
    local balance = tonumber(redis.call('GET', balanceKey))
    
    if not balance or balance < betAmount then
      return {0, 'INSUFFICIENT_BALANCE'}
    end
    
    -- 3. Get and increment nonce ATOMICALLY
    local nonce = redis.call('INCR', 'nonce:user:' .. username)
    
    -- 4. Parse game data and inject nonce
    local gameData = cjson.decode(gameDataStr)
    gameData.nonce = nonce
    
    -- 5. Decrement balance
    local newBalance = redis.call('INCRBYFLOAT', balanceKey, -betAmount)
    
    -- 6. Save game
    redis.call('SET', 'mines:' .. gameId, cjson.encode(gameData))
    redis.call('EXPIRE', 'mines:' .. gameId, 86400) -- 24 hour TTL

    -- 7. Mark as active game

    redis.call('SET', 'user:mines:active:' .. username, gameId)
    redis.call('EXPIRE', 'user:mines:active:' .. username, 3600)
    
    -- 8. Mark balance as dirty for DB sync (async)
    redis.call('SADD', 'user:balance:dirty', username)
    
    return {1, nonce, newBalance}
  `;

    try {
      const result: any = await this.mainClient.eval(luaScript, {
        keys: [],
        arguments: [
          username,
          betAmount.toString(),
          gameId,
          gameDataWithoutNonce,
        ],
      });

      if (Array.isArray(result)) {
        if (result[0] === 0) {
          return { success: false, error: result[1] as string };
        }
        return {
          success: true,
          nonce: result[1] as number,
          balance: result[2] as number,
        };
      }

      return { success: false, error: 'UNKNOWN_ERROR' };
    } catch (err) {
      this.logger.error('Atomic create mines game failed', err);
      return { success: false, error: 'REDIS_ERROR' };
    }
  }

  /**
   * ⚡ Batch fetch user data in single pipeline
   * Gets balance, clientSeed, and active game
   * Target: 10-15ms
   */
  async batchFetchUserData(username: string): Promise<{
    balance: number | null;
    clientSeed: string | null;
    nonce: number | null;
    activeGameId: string | null;
  }> {
    try {
      const results = await this.mainClient
        .multi()
        .get(`user:${username}:balance`)
        .get(`user:${username}:clientSeed`)
        .get(`user:${username}:nonce`)
        .get(`user:${username}:active_game`)
        .exec();

      const balanceStr = this.toStringOrNull(results[0]);
      const clientSeed = this.toStringOrNull(results[1]);
      const nonceStr = this.toStringOrNull(results[2]);
      const activeGameId = this.toStringOrNull(results[3]);

      return {
        balance: balanceStr ? parseFloat(balanceStr) : null,
        clientSeed,
        nonce: nonceStr ? parseInt(nonceStr, 10) : null,
        activeGameId,
      };
    } catch (err) {
      this.logger.error('Batch fetch user data failed', err);
      return {
        balance: null,
        clientSeed: null,
        nonce: null,
        activeGameId: null,
      };
    }
  }

  /**
   * ⚡ Atomic balance check and decrement
   * Returns new balance or null if insufficient
   */
  async checkAndDecrementBalance(
    username: string,
    amount: number,
  ): Promise<number | null> {
    const luaScript = `
      local balance = redis.call('GET', KEYS[1])
      if not balance then
        return nil
      end
      balance = tonumber(balance)
      if balance >= tonumber(ARGV[1]) then
        balance = balance - tonumber(ARGV[1])
        redis.call('SET', KEYS[1], balance)
        redis.call('SADD', 'balances:dirty', ARGV[2])
        return balance
      end
      return nil
    `;

    try {
      const result = await this.mainClient.eval(luaScript, {
        keys: [`user:${username}:balance`],
        arguments: [amount.toString(), username],
      });

      return result !== null ? parseFloat(result as string) : null;
    } catch (err) {
      this.logger.error('Check and decrement balance failed', err);
      return null;
    }
  }

  /**
   * ⚡ Atomic balance increment (for cashouts/wins)
   */
  async incrementBalance(username: string, amount: number): Promise<void> {
    try {
      await this.mainClient
        .multi()
        .incrByFloat(`user:balance:${username}`, amount)
        .sAdd('user:balance:dirty', username)
        .exec();
    } catch (err) {
      this.logger.error('Increment balance failed', err);
    }
  }

  /**
   * Get game from Redis cache
   */
  async getGame(gameId: string): Promise<any | null> {
    try {
      const gameData = await this.mainClient.get(`game:${gameId}`);
      return gameData ? JSON.parse(gameData) : null;
    } catch (err) {
      this.logger.error('Get game failed', err);
      return null;
    }
  }

  /**
   * Get user's active game
   */
  async getUserActiveGame(username: string): Promise<string | null> {
    try {
      return await this.mainClient.get(`user:${username}:active_game`);
    } catch (err) {
      this.logger.error('Get user active game failed', err);
      return null;
    }
  }

 

  /**
   * Pop from queue (blocking)
   */
  async brpop(key: string, timeoutSeconds: number): Promise<string | null> {
    try {
      const result = await this.mainClient.brPop(key, timeoutSeconds);
      return result?.element || null;
    } catch (err) {
      this.logger.error('BRPOP failed', err);
      return null;
    }
  }

  /**
   * Pop from queue (non-blocking)
   */
  async rpop(key: string): Promise<string | null> {
    try {
      return await this.mainClient.rPop(key);
    } catch (err) {
      this.logger.error('RPOP failed', err);
      return null;
    }
  }

  /* ---------------- EXPIRY OPS ---------------- */

  async expire(key: string, seconds: number): Promise<number> {
    return this.mainClient.expire(key, seconds);
  }

  async pexpire(key: string, milliseconds: number): Promise<number> {
    return this.mainClient.pExpire(key, milliseconds);
  }

  async ttl(key: string): Promise<number> {
    return this.mainClient.ttl(key);
  }

  /* ---------------- BATCH OPS ---------------- */

  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) return [];
    return this.mainClient.mGet(keys);
  }

  async executeTransaction(
    commands: Array<{
      command: string;
      args: any[];
    }>,
  ): Promise<any[]> {
    const multi = this.mainClient.multi();

    for (const { command, args } of commands) {
      (multi as any)[command](...args);
    }

    return multi.exec();
  }

  /* ---------------- HASH OPS ---------------- */

  async hset(key: string, field: string, value: string): Promise<number> {
    return this.mainClient.hSet(key, field, value);
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.mainClient.hGet(key, field);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.mainClient.hGetAll(key);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    return this.mainClient.hDel(key, fields);
  }

  async hexists(key: string, field: string): Promise<number> {
    return this.mainClient.hExists(key, field);
  }

  /* ---------------- LIST OPS ---------------- */

  async rpush(key: string, ...values: string[]): Promise<number> {
    return this.mainClient.rPush(key, values);
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    return this.mainClient.lPush(key, values);
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.mainClient.lRange(key, start, stop);
  }

  async llen(key: string): Promise<number> {
    return this.mainClient.lLen(key);
  }

  /* ---------------- SORTED SET OPS ---------------- */

  async zadd(
    key: string,
    members: Array<{ score: number; value: string }>,
  ): Promise<number> {
    return this.mainClient.zAdd(key, members);
  }

  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.mainClient.zRange(key, start, stop);
  }

  async zrevrange(key: string, start: number, stop: number): Promise<string[]> {
    return this.mainClient.zRange(key, start, stop, { REV: true });
  }

  async zscore(key: string, member: string): Promise<number | null> {
    return this.mainClient.zScore(key, member);
  }

  async zrem(key: string, ...members: string[]): Promise<number> {
    return this.mainClient.zRem(key, members);
  }

  /* ---------------- PATTERN MATCHING ---------------- */

  async keys(pattern: string): Promise<string[]> {
    return this.mainClient.keys(pattern);
  }

  async scan(
    cursor: RedisArgument,
    pattern?: string,
    count?: number,
  ): Promise<{ cursor: RedisArgument; keys: string[] }> {
    const result = await this.mainClient.scan(cursor, {
      MATCH: pattern,
      COUNT: count,
    });
    return {
      cursor: result.cursor,
      keys: result.keys,
    };
  }
  toStringOrNull = (v: unknown): string | null => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return v.toString();
    if (Buffer.isBuffer(v)) return v.toString();
    return null;
  };

  /* ---------------- LUA SCRIPT EXECUTION ---------------- */

  /**
   * Execute a Lua script
   * @param script - Lua script to execute
   * @param options - Keys and arguments for the script
   */
  async eval(
    script: string,
    options: {
      keys?: string[];
      arguments?: string[];
    },
  ): Promise<any> {
    try {
      return await this.mainClient.eval(script, options);
    } catch (err) {
      this.logger.error('Lua script execution failed', err);
      throw err;
    }
  }

  /* ---------------- UTILITY ---------------- */

  getClient(): RedisClientType {
    return this.mainClient;
  }
}
