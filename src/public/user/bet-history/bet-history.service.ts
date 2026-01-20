import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/provider/redis/redis.service";
import { BetHistoryResponse } from "src/public/user/bet-history/result/get-bet-history.result";


@Injectable()
export class BetHistoryService {
  private readonly logger = new Logger(BetHistoryService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService
  ) {}

  async getBetHistory(
    username: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<BetHistoryResponse> {
    try {
      // Step 1: Try to get games from Redis first
      const redisGames = await this.getGamesFromRedis(username, page, pageSize);
      
      if (redisGames && redisGames.data.length > 0) {
        this.logger.debug(`Returning ${redisGames.data.length} games from Redis for user ${username}`);
        return redisGames;
      }

      // Step 2: Fallback to database if Redis returns no data
      this.logger.debug(`No Redis data found, falling back to database for user ${username}`);
      return await this.getGamesFromDatabase(username, page, pageSize);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error fetching bet history for user ${username}: ${error.message}`
        );
      } else {
        this.logger.error(
          `Unknown error fetching bet history for user ${username}`
        );
      }
      throw new BadRequestException("Failed to fetch bet history");
    }
  }

  private async getGamesFromRedis(
    username: string,
    page: number,
    pageSize: number
  ): Promise<BetHistoryResponse | null> {
    try {
      const userHistoryKey = `user:${username}:games:history`;

      // Get total count
      const total = await this.redisService.mainClient.zCard(userHistoryKey);

      if (total === 0) {
        return null;
      }

      // Calculate pagination
      const skip = (page - 1) * pageSize;
      const end = skip + pageSize - 1;

      // Get game IDs in reverse chronological order (most recent first)
      const gameIds = await this.redisService.mainClient.zRange(
        userHistoryKey,
        -1 - end,
        -1 - skip,
        { REV: true }
      );

      if (gameIds.length === 0) {
        return null;
      }

      // Fetch all game details using pipeline for efficiency
      const pipeline = this.redisService.mainClient.multi();
      
      for (const gameId of gameIds) {
        const historyKey = `game:history:${gameId}`;
        pipeline.hGetAll(historyKey);
      }

      const results = await pipeline.exec();
      
      if (!results) {
        return null;
      }

      // Transform Redis data to match database format
      const data:any = results
        .map((result, index) => {
          if (!result || typeof result !== 'object') return null;
          
          const gameData = result as any;
          
          // Skip if game data is incomplete
          if (!gameData.gameId || !gameData.gameType) {
            this.logger.warn(`Incomplete game data in Redis for gameId: ${gameIds[index]}`);
            return null;
          }

          return {
            id: gameData.id || gameIds[index],
            gameType: gameData.gameType,
            betAmount: parseFloat(gameData.betAmount || '0'),
            userUsername: gameData.username,
            profit: gameData.profit ? parseFloat(gameData.profit) : 0,
            serverSeedHash: gameData.serverSeedHash,
            clientSeed: gameData.clientSeed,
            nonce: parseInt(gameData.nonce || '0'),
            startedAt: new Date(gameData.startedAt),
            finalMultiplier: parseFloat(gameData.multiplier || '1'),
            payout: gameData.payout ? parseFloat(gameData.payout) : 0,
            outcome: gameData.outcome as 'WON' | 'LOST' | 'CASHED_OUT' | 'PLAYING',
            seedRotationHistory: gameData.serverSeed 
              ? { serverSeed: gameData.serverSeed }
              : null,
          };
        })
        .filter(Boolean); 

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      this.logger.error(`Error fetching games from Redis for user ${username}:`, error);
      return null; // Return null to trigger database fallback
    }
  }

  private async getGamesFromDatabase(
    username: string,
    page: number,
    pageSize: number
  ): Promise<BetHistoryResponse> {
    const skip = (page - 1) * pageSize;
    
    const [userGameData, total] = await this.prismaService.$transaction([
      this.prismaService.gameHistory.findMany({
        where: {
          userUsername: username
        },
        select: {
          id: true,
          gameType: true,
          betAmount: true,
          userUsername: true,
          profit: true,
          serverSeedHash: true,
          clientSeed: true,
          nonce: true,
          startedAt: true,
          finalMultiplier: true,
          payout: true,
          outcome: true,
          seedRotationHistory: {
            select: {
              serverSeed: true
            }
          }
        },
        orderBy: { startedAt: 'desc' },
        skip,
        take: pageSize
      }),
      this.prismaService.gameHistory.count({
        where: {
          userUsername: username
        }
      })
    ]);

    return {
      data: userGameData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  // Optional: Method to sync database games to Redis for better performance
  async syncUserGamesToRedis(username: string, limit: number = 100): Promise<void> {
    try {
      const games = await this.prismaService.gameHistory.findMany({
        where: { userUsername: username },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          gameId: true,
          gameType: true,
          betAmount: true,
          finalMultiplier: true,
          profit: true,
          payout: true,
          outcome: true,
          serverSeedHash: true,
          clientSeed: true,
          nonce: true,
          startedAt: true,
          completedAt: true,
          gameConfig: true,
          gameData: true,
          seedRotationHistory: {
            select: { serverSeed: true }
          }
        }
      });

      if (games.length === 0) {
        return;
      }

      const pipeline = this.redisService.mainClient.multi();
      const userHistoryKey = `user:${username}:games:history`;

      for (const game of games) {
        const historyKey = `game:history:${game.id}`;
        const gameConfig = game.gameConfig as any;

        // Store game details
        pipeline.hSet(historyKey, {
          id: game.id,
          gameId: game.gameId,
          username: username,
          gameType: game.gameType,
          betAmount: game.betAmount.toString(),
          multiplier: (game.finalMultiplier || 1).toString(),
          mines: gameConfig?.minesCount?.toString() || '0',
          gridSize: gameConfig?.gridSize?.toString() || '25',
          mineMask: '0', // Not available in database
          revealedMask: '0', // Not available in database
          active: game.outcome === 'PLAYING' ? '1' : '0',
          serverSeedHash: game.serverSeedHash,
          serverSeed: game.seedRotationHistory?.serverSeed || '',
          clientSeed: game.clientSeed,
          nonce: game.nonce.toString(),
          startedAt: game.startedAt.toISOString(),
          completedAt: game.completedAt?.toISOString() || '',
          outcome: game.outcome,
          payout: (game.payout || 0).toString(),
          profit: (game.profit || 0).toString(),
        });

        // Add to sorted set
        const timestamp = new Date(game.startedAt).getTime();
        pipeline.zAdd(userHistoryKey, {
          score: timestamp,
          value: game.id,
        });

        // Set appropriate TTL
        const ttl = game.outcome === 'PLAYING' ? 60 * 60 * 24 * 7 : 60 * 60 * 24 * 5;
        pipeline.expire(historyKey, ttl);
      }

      // Keep only last 100 games
      pipeline.zRemRangeByRank(userHistoryKey, 0, -101);

      await pipeline.exec();
      this.logger.log(`Synced ${games.length} games to Redis for user ${username}`);
    } catch (error) {
      this.logger.error(`Failed to sync games to Redis for user ${username}:`, error);
    }
  }
}