import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/provider/redis/redis.service';

@Injectable()
export class MinesHistoryService {
  private readonly logger = new Logger(MinesHistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getUserHistory(username: string, limit = 10) {
    try {
      const redisGames = await this.getFromRedis(username, limit);
      return redisGames;
    } catch (error) {
      this.logger.warn('Redis history fetch failed', error);
    }

    return await this.getFromDatabase(username, limit);
  }

  async getGameById(gameId: string) {
    try {
      const redisGame = await this.getRedisGameById(gameId);
      if (redisGame) return redisGame;
    } catch (error) {
      this.logger.warn(`Redis fetch failed for game ${gameId}`, error);
    }

    return await this.prisma.gameHistory.findUnique({ where: { gameId } });
  }



  private async getFromRedis(username: string, limit: number) {
    try {
      const userHistoryKey = `user:${username}:games:history`;

      // Get last N game IDs
      const gameIds = await this.redisService.mainClient.zRange(
        userHistoryKey,
        0,
        limit - 1,
      );

      if (!gameIds || gameIds.length === 0) {
        return null;
      }

      // Fetch game details for each ID
      const games = await Promise.all(
        gameIds.map(async (gameId) => {
          const historyKey = `game:history:${gameId}`;
          const gameData =
            await this.redisService.mainClient.hGetAll(historyKey);

          if (!gameData || Object.keys(gameData).length === 0) {
            return null;
          }

          return {
            betAmount: parseFloat(gameData.betAmount),
            finalMultiplier: parseFloat(gameData.multiplier),
            outcome: gameData.outcome ,
            startedAt: new Date(gameData.startedAt),
          };
        }),
      );

      return games.filter((game) => game !== null);
    } catch (error) {
      this.logger.error('Failed to get Redis game history:', error);
      return null;
    }
  }

  private async getFromDatabase(username: string, limit: number) {
    const games = await this.prisma.gameHistory.findMany({
      where: {
        userUsername: username,
        gameType: 'MINES',
      },
      select: {
        betAmount: true,
        finalMultiplier: true,
        outcome: true,
        startedAt: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
    });
    return games;
  }

  private async getRedisGameById(gameId: string) {
    try {
      const historyKey = `game:history:${gameId}`;
      const gameData = await this.redisService.mainClient.hGetAll(historyKey);

      if (!gameData || Object.keys(gameData).length === 0) {
        return null;
      }

      return {
        gameId: gameData.gameId,
        username: gameData.username,
        gameType: gameData.gameType,
        betAmount: parseFloat(gameData.betAmount),
        finalMultiplier: parseFloat(gameData.multiplier),
        outcome: gameData.outcome,
        startedAt: new Date(gameData.startedAt),
        completedAt: gameData.completedAt
          ? new Date(gameData.completedAt)
          : null,
        payout: gameData.payout ? parseFloat(gameData.payout) : null,
        profit: gameData.profit ? parseFloat(gameData.profit) : null,
        gameConfig: {
          gridSize: parseInt(gameData.gridSize),
          minesCount: parseInt(gameData.mines),
        },
        serverSeedHash: gameData.serverSeedHash,
        clientSeed: gameData.clientSeed,
        nonce: parseInt(gameData.nonce),
      };
    } catch (error) {
      this.logger.error(`Failed to get game ${gameId} from Redis:`, error);
      return null;
    }
  }
}
