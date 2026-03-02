import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis.service.js';
import {
  IMinesCachePort,
  AtomicRevealResult,
  RawGameState,
} from '../../../application/game/mines/ports/mines-cache.port.js';
import { RedisKeys } from '../redis.keys.js';

const activeGameKey = RedisKeys.mines.activeGame;
const gameKey = (gameId: string) => RedisKeys.mines.game(gameId);

const GAME_TTL_SECONDS = 86_400; // 24 h
const ACTIVE_POINTER_TTL_SECONDS = 3_600; // 1 h

@Injectable()
export class MinesGameStateCacheAdapter implements IMinesCachePort {
  constructor(private readonly redis: RedisService) {}

  async atomicRevealTile(
    gameId: string,
    tileIndex: number,
    updates: Record<string, unknown>,
  ): Promise<AtomicRevealResult> {
    const key = gameKey(gameId);
    const success = await this.redis.atomicRevealTile(
      key,
      BigInt(0),
      tileIndex,
      updates as Record<string, any>,
    );
    return { success };
  }

  async getActiveGame(username: string): Promise<RawGameState | null> {
    const gameId = await this.redis.get<string>(activeGameKey(username));
    if (!gameId) return null;
    return this.getGameById(gameId);
  }

  async getGameById(gameId: string): Promise<RawGameState | null> {
    return this.redis.get<RawGameState>(gameKey(gameId));
  }

  async updateGame(gameId: string, updates: Record<string, unknown>): Promise<void> {
    const key = gameKey(gameId);
    const current = await this.redis.get<RawGameState>(key);
    if (!current) return;
    await this.redis.set(key, { ...current, ...updates }, GAME_TTL_SECONDS);
  }

  async deleteActiveGame(username: string, _gameId: string): Promise<void> {
    await this.redis.del(activeGameKey(username));
  }
}
