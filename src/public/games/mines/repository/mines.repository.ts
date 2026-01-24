import { RedisService } from 'src/provider/redis/redis.service';
import { MinesGame } from '../types/mines.types';
import { Injectable } from '@nestjs/common';
import { RedisKeys } from 'src/provider/redis/redis.keys';

@Injectable()
export class MinesRepository {
  constructor(readonly redis: RedisService) {}

  /* ---------------- FAST PATH ---------------- */
  async getGame(id: string): Promise<MinesGame | null> {
    return this.redis.get<MinesGame>(RedisKeys.mines.game(id));
  }

  async getUserActiveGame(username: string): Promise<MinesGame | null> {
    const gameId = await this.redis.get<string>(
      `user:mines:active:${username}`,
    );
    if (!gameId) return null;
    return this.getGame(gameId);
  }

  async clearActiveGame(username: string) {
    await this.redis.del(`user:mines:active:${username}`);
  }

  async deleteGame(gameId: string, username: string) {
    await this.redis
      .getClient()
      .multi()
      .del(RedisKeys.mines.game(gameId))
      .del(`user:mines:active:${username}`)
      .exec();
  }

  async lockGameTile(gameId: string, tile: string) {
    return this.redis.lock(`lock:${RedisKeys.lock.mines(gameId)}:${tile}`, 10_000);
  }

  /* ---------------- UPDATE METHODS ---------------- */
  /**
   * Update game fields
   * @param gameId - Game ID
   * @param updates - Partial game object with fields to update
   */
  async updateGame(
    gameId: string,
    updates: Partial<MinesGame>,
    gameData?: any,
  ): Promise<boolean> {
    const key = RedisKeys.mines.game(gameId);

    // Fast path — single SET, 1 RTT
    if (gameData) {
      await this.redis.mainClient.set(
        key,
        JSON.stringify({ ...gameData, ...updates }),
      );
      return true;
    }

    // Slow path — must fetch first
    const raw = await this.redis.mainClient.get(key);
    if (!raw) return false;

    const game: MinesGame = JSON.parse(raw);

    await this.redis.mainClient.set(
      key,
      JSON.stringify({ ...game, ...updates }),
    );

    return true;
  }

  /**
   * Update specific fields without fetching the entire game
   * More efficient for single field updates
   */
  async updateGameFields(
    gameId: string,
    updates: Record<string, any>,
  ): Promise<boolean> {
    const client = this.redis.getClient();
    const key = RedisKeys.mines.game(gameId);

    // Check if game exists
    const exists = await client.exists(key);
    if (!exists) return false;

    // Update multiple fields using HSET
    const updatePromises = Object.entries(updates).map(([field, value]) =>
      client.hSet(key, field, JSON.stringify(value)),
    );

    await Promise.all(updatePromises);
    return true;
  }

  /* ---------------- GAMEPLAY ATOMICS ---------------- */
  async atomicUpdateIfActive(
    gameId: string,
    updates: Partial<MinesGame>,
  ): Promise<boolean> {
    return this.redis.atomicUpdateIfMatch(
      RedisKeys.mines.game(gameId),
      'active',
      true,
      updates as Record<string, any>,
    );
  }

  async atomicUpdateIfActiveAndMaskUnchanged(
    gameId: string,
    expectedMask: number,
    updates: Partial<MinesGame>,
  ): Promise<boolean> {
    return this.redis.atomicUpdateIfMultiMatch(
      RedisKeys.mines.game(gameId),
      { active: true, revealedMask: expectedMask },
      updates as Record<string, any>,
    );
  }

  async atomicRevealTile(
    gameId: string,
    tileBit: number,
    tileIndex: number,
    updates: Partial<MinesGame>,
  ): Promise<boolean> {
    return this.redis.atomicRevealTile(
      RedisKeys.mines.game(gameId),
      tileBit,
      tileIndex,
      updates as Record<string, any>,
    );
  }
}
