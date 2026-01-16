import { RedisService } from 'src/provider/redis/redis.service';
import { MinesGame } from './types/mines.types';
import { Injectable } from '@nestjs/common';

@Injectable()
export class MinesRepository {
  constructor(readonly redis: RedisService) {}

  /* ---------------- FAST PATH ---------------- */
  async getGame(id: string): Promise<MinesGame | null> {
    return this.redis.get<MinesGame>(`mines:${id}`);
  }

  async getUserActiveGame(username: string): Promise<MinesGame | null> {
    const gameId = await this.redis.get<string>(`user:active:${username}`);
    if (!gameId) return null;
    return this.getGame(gameId);
  }

  async clearActiveGame(username: string) {
    await this.redis.del(`user:active:${username}`);
  }

  async deleteGame(gameId: string, username: string) {
    await this.redis
      .getClient()
      .multi()
      .del(`mines:${gameId}`)
      .del(`user:active:${username}`)
      .exec();
  }

  async lockGameTile(gameId: string, tile: string) {
    return this.redis.lock(`lock:mines:${gameId}:${tile}`, 10_000);
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
  ): Promise<boolean> {
    const game = await this.getGame(gameId);
    if (!game) return false;

    const updatedGame = { ...game, ...updates };
    await this.redis.set(`mines:${gameId}`, updatedGame);
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
    const key = `mines:${gameId}`;

    // Check if game exists
    const exists = await client.exists(key);
    if (!exists) return false;

    // Update multiple fields using HSET
    const updatePromises = Object.entries(updates).map(([field, value]) =>
      client.hSet(key, field, JSON.stringify(value))
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
      `mines:${gameId}`,
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
      `mines:${gameId}`,
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
      `mines:${gameId}`,
      tileBit,
      tileIndex,
      updates as Record<string, any>,
    );
  }
}