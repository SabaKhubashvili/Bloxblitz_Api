import { Injectable, Logger } from '@nestjs/common';
import { GameType } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';

@Injectable()
export class SharedUserGamesService {
  private readonly logger = new Logger(SharedUserGamesService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async getActiveGames(
    username: string,
  ): Promise<{ gameType: GameType; id: string }[]> {
    const key = RedisKeys.user.games.active(username);

    // Try to get from list first
    const listGames = await this.redis.mainClient.lRange(key, 0, -1);
    if (listGames.length > 0) {
      this.logger.log(`Cache hit (list) for active games of user ${username}`);
      return listGames.map((g) => JSON.parse(g));
    }

    // Check if list exists but is empty
    const listExists = await this.redis.mainClient.exists(key);
    if (listExists) {
      this.logger.log(
        `Cache hit (empty list) for active games of user ${username}`,
      );
      return [];
    }

    // Cache miss - query database
    this.logger.log(`Cache miss for active games of user ${username}`);
    const dbGames = await this.prisma.gameHistory.findMany({
      where: { username: username, status: 'PLAYING' },
      select: { gameType: true, id: true },
    });

    // Store in list format
    if (dbGames.length > 0) {
      const multi = this.redis.mainClient.multi();
      dbGames.forEach((game) => {
        multi.rPush(key, JSON.stringify(game));
      });
      multi.expire(key, 300);
      await multi.exec();
    } else {
      // FIXED: Create empty list instead of empty string
      // Using LPUSH with no elements won't work, so we use a placeholder approach
      const multi = this.redis.mainClient.multi();
      multi.del(key); // Ensure key doesn't exist
      multi.rPush(key, '__PLACEHOLDER__'); // Create list
      multi.lPop(key); // Remove placeholder, leaving empty list
      multi.expire(key, 300);
      await multi.exec();
    }

    return dbGames;
  }
  async deleteActiveGamesCache(username: string) {
    const key = RedisKeys.user.games.active(username);

    await this.redis.mainClient.del(key);
  }

  async removeActiveGame(username: string, gameId: string) {
    const key = RedisKeys.user.games.active(username);

    const listGames = await this.redis.mainClient.lRange(key, 0, -1);

    if (listGames.length > 0) {
      for (const gameStr of listGames) {
        const game = JSON.parse(gameStr);
        if (game.gameId === gameId) {
          await this.redis.mainClient.lRem(key, 1, gameStr);
          // Refresh TTL
          await this.redis.mainClient.expire(key, 300);
          return;
        }
      }
    }
  }

  // Optimized: No read required, just append
  async addActiveGame(
    username: string,
    game: { id: string; gameType: GameType },
  ) {
    const key = RedisKeys.user.games.active(username);

    // Check if cache exists
    const cacheExists = this.redis.mainClient.exists(key);

    if (!cacheExists) {
      // Cache miss - need to initialize from database
      this.logger.log(`Cache miss on addActiveGame for user ${username}`);

      const dbGames = await this.prisma.gameHistory.findMany({
        where: { username: username, status: 'PLAYING' },
        select: { gameType: true, id: true },
      });

      // Add existing games + new game to list
      const multi = this.redis.mainClient.multi();
      dbGames.forEach((g) => {
        multi.rPush(key, JSON.stringify(g));
      });
      multi.rPush(key, JSON.stringify(game));
      multi.expire(key, 300);
      await multi.exec();
    } else {
      // Cache exists - just append
      await this.redis.mainClient.rPush(key, JSON.stringify(game));
      await this.redis.mainClient.expire(key, 300);
    }
  }
}
