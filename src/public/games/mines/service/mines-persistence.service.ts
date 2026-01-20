import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/provider/redis/redis.service';
import { BetHistoryService } from 'src/private/user/bet-history/private-bet-history.service';

import { Prisma } from '@prisma/client';
import { MinesGame } from '../types/mines.types';
import { MinesCalculationService } from './mines-calculation.service';
import { UpdateBetHistoryDto } from 'src/private/user/bet-history/dto/update-bet-history.dto';
import { RedisGameUpdate } from '../types/redis-game-update.type';

@Injectable()
export class MinesPersistenceService {
  private readonly logger = new Logger(MinesPersistenceService.name);
  private readonly GAME_HISTORY_TTL = 60 * 60 * 24 * 7;
  private readonly COMPLETED_GAME_TTL = 60 * 60 * 24 * 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly betHistoryService: BetHistoryService,
    private readonly minesCalculationService: MinesCalculationService,
  ) {}

  async backupGame(
    gameId: string,
    username: string,
    gameData: Omit<MinesGame, 'betId'>,
  ): Promise<string> {
   return await this.backupToDatabase(gameId, username, gameData).then((data) => {
      if (data) {
        this.logger.log(`Game ${gameId} backed up to database successfully`);
        this.saveToRedisHistory(data.id /* This is Bet Id */, {betId: data.id, ...gameData}).catch((err) => {
          this.logger.error(
            `Failed to save game ${gameId} to Redis history:`,
            err,
          );
        });
      } else {
        this.logger.warn(
          `No data returned when backing up game ${gameId} to database`,
        );
      }

      return data.id; // Return Bet Id
    });
  }

  async updateGame(
    
    gameId: string,
    gameData: MinesGame,
    updates: {
      revealedTiles?: number[];
      active?: boolean;
      multiplier?: number;
      outcome?: 'WON' | 'LOST' | 'CASHED_OUT';
      completedAt?: Date;
      payout?: number;
      profit?: number;
      cashoutTile?: number | null;
    },
  ): Promise<void> {
    await Promise.all([
      this.updateDatabase(gameId, gameData, updates),
      this.updateRedis(gameData.betId, updates),
    ]);
  }

  private async backupToDatabase(
    gameId: string,
    username: string,
    gameData: Omit<MinesGame, 'betId'>,
  ) {
    try {
      return await this.betHistoryService.add({
        gameId: gameId,
        username,
        gameType: 'MINES',

        // Provably fair data
        serverSeedHash: gameData.serverSeedHash,
        clientSeed: gameData.clientSeed,
        nonce: gameData.nonce,

        // Game-specific config stored in JSON
        gameConfig: {
          gridSize: gameData.grid,
          minesCount: gameData.mines,
        } as Prisma.JsonObject,

        // Game-specific data stored in JSON
        gameData: {
          revealedTiles: [],
          minePositions: this.minesCalculationService.maskToTileArray(
            gameData.mineMask,
          ),
          cashoutTile: null,
        } as Prisma.JsonObject,

        // Financial data
        betAmount: gameData.betAmount,
        finalMultiplier: gameData.multiplier,
        payout: 0,
        profit: -gameData.betAmount,

        outcome: 'PLAYING',
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Database backup failed for game ${gameId}:`, error);
      throw error;
    }
  }

  private async saveToRedisHistory(
    gameId: string,
    gameData: MinesGame
  ): Promise<void> {
    try {
      const historyKey = `game:history:${gameId}`;
      const userHistoryKey = `user:${gameData.creatorUsername}:games:history`;

      // Store complete game data
      await this.redisService.mainClient.hSet(historyKey, {
        gameId,
        username: gameData.creatorUsername,
        gameType: 'MINES',
        betAmount: gameData.betAmount.toString(),
        multiplier: gameData.multiplier.toString(),
        mines: gameData.mines.toString(),
        gridSize: gameData.grid.toString(),
        mineMask: gameData.mineMask.toString(),
        revealedMask: gameData.revealedMask.toString(),
        active: gameData.active ? '1' : '0',
        serverSeedHash: gameData.serverSeedHash,
        clientSeed: gameData.clientSeed,
        nonce: gameData.nonce.toString(),
        startedAt: new Date().toISOString(),
        outcome: gameData.outcome,
      });

      // Set TTL for active games (longer)
      await this.redisService.mainClient.expire(
        historyKey,
        this.GAME_HISTORY_TTL,
      );

      // Add to user's game history list (sorted by timestamp)
      const timestamp = Date.now();
      await this.redisService.mainClient.zAdd(userHistoryKey, {
        score: timestamp,
        value: gameId,
      });

      // Keep only last 100 games per user
      await this.redisService.mainClient.zRemRangeByRank(
        userHistoryKey,
        0,
        -101,
      );

      this.logger.debug(`Game ${gameId} saved to Redis history`);
    } catch (error) {
      this.logger.error(
        `Failed to save game ${gameId} to Redis history:`,
        error,
      );
      throw error;
    }
  }

  private async updateDatabase(
    gameId: string,
    gameData: MinesGame,
    updates: any,
  ): Promise<void> {
    try {
      // Get current game data from database
      const currentGame = await this.prisma.gameHistory.findUnique({
        where: { gameId },
        select: { gameId: true, gameData: true, startedAt: true },
      });

      if (!currentGame) {
        this.logger.warn(`Game ${gameId} not found in database for update`);
        return;
      }

      const currentGameData = currentGame.gameData as {
        revealedTiles: number[];
        minePositions: number[];
        cashoutTile: number | null;
      };

      // Prepare update data
      const updateData: UpdateBetHistoryDto = {
        gameId: currentGame.gameId,
        username: gameData.creatorUsername,
      };

      // Update gameData JSON field
      updateData.gameData = {
        revealedTiles: updates.revealedTiles || currentGameData.revealedTiles,
        minePositions: currentGameData.minePositions,
        cashoutTile:
          updates.cashoutTile !== undefined
            ? updates.cashoutTile
            : currentGameData.cashoutTile,
      } as Prisma.JsonObject;

      // If game ended, reveal mine positions
      if (updates.completedAt) {
        (updateData.gameData as any).minePositions =
          this.minesCalculationService.maskToTileArray(gameData.mineMask);
      }

      // Update multiplier
      if (updates.multiplier !== undefined) {
        updateData.finalMultiplier = updates.multiplier;
      }

      // Update outcome
      if (updates.outcome) {
        updateData.outcome = updates.outcome;
      }

      // Update completion time and calculate duration
      if (updates.completedAt) {
        updateData.completedAt = updates.completedAt.toISOString();
        updateData.duration = Math.floor(
          (updates.completedAt.getTime() - currentGame.startedAt.getTime()) /
            1000,
        );
      }

      // Update financial data
      if (updates.payout !== undefined) {
        updateData.payout = updates.payout;
      }

      if (updates.profit !== undefined) {
        updateData.profit = updates.profit;
      }

      await this.betHistoryService.update({
        ...updateData,
      });

      this.logger.debug(`Game history ${gameId} updated successfully`);
    } catch (error) {
      this.logger.error(`Failed to update game history for ${gameId}:`, error);
    }
  }

  private async updateRedis(
    gameId: string,
    updates: RedisGameUpdate['updates'],
  ): Promise<void> {
    try {
      const historyKey = `game:history:${gameId}`;
      const exists = await this.redisService.mainClient.exists(historyKey);

      if (!exists) {
        this.logger.warn(`Game ${gameId} not found in Redis history`);
        return;
      }

      const updateData: Record<string, string> = {};

      if (updates.revealedMask !== undefined) {
        updateData.revealedMask = updates.revealedMask.toString();
      }
      if (updates.active !== undefined) {
        updateData.active = updates.active ? '1' : '0';
      }
      if (updates.multiplier !== undefined) {
        updateData.multiplier = updates.multiplier.toString();
      }
      if (updates.outcome) {
        updateData.outcome = updates.outcome;
      }
      if (updates.completedAt) {
        updateData.completedAt = updates.completedAt.toISOString();
      }
      if (updates.payout !== undefined) {
        updateData.payout = updates.payout.toString();
      }
      if (updates.profit !== undefined) {
        updateData.profit = updates.profit.toString();
      }
      if (updates.serverSeed !== undefined) {
        updateData.serverSeed = updates.serverSeed;
      }
      if (updates.outcome) {
        updateData.outcome = updates.outcome;
      }

      if (Object.keys(updateData).length > 0) {
        await this.redisService.mainClient.hSet(historyKey, updateData);

        // If game completed, reduce TTL
        if (updates.active === false) {
          await this.redisService.mainClient.expire(
            historyKey,
            this.COMPLETED_GAME_TTL,
          );
        }

        this.logger.debug(`Redis history updated for game ${gameId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to update Redis history for ${gameId}:`, error);
    }
  }
  async updateRedisBulk(items: RedisGameUpdate[]): Promise<void> {
    if (items.length === 0) return;

    try {
      const pipeline = this.redisService.mainClient.multi();

      for (const { gameId, updates } of items) {
        const historyKey = `game:history:${gameId}`;
        const updateData: Record<string, string> = {};
        this.logger.log(
          `Updating Redis game ${gameId} with data: ${JSON.stringify(updates)}`,
        );

        if (updates.revealedMask !== undefined) {   
          updateData.revealedMask = updates.revealedMask.toString();
        }
        if (updates.active !== undefined) {
          updateData.active = updates.active ? '1' : '0';
        }
        if (updates.multiplier !== undefined) {
          updateData.multiplier = updates.multiplier.toString();
        }

        if (updates.outcome) {
          updateData.outcome = updates.outcome;
        }
        if (updates.outcome !== undefined) {
          updateData.outcome = updates.outcome;
        }
        if (updates.completedAt !== undefined) {
          updateData.completedAt = updates.completedAt.toISOString();
        }
        if (updates.payout !== undefined) {
          updateData.payout = updates.payout.toString();
        }
        if (updates.profit !== undefined) {
          updateData.profit = updates.profit.toString();
        }
        if (updates.serverSeed !== undefined) {
          updateData.serverSeed = updates.serverSeed;
        }

        if (Object.keys(updateData).length === 0) continue;

        // No EXISTS check — HSET on missing key is cheap & safe
        pipeline.hSet(historyKey, updateData);

        // Reduce TTL only when game completes
        if (updates.active === false) {
          pipeline.expire(historyKey, this.COMPLETED_GAME_TTL);
        }
      }

      await pipeline.exec();
    } catch (error) {
      this.logger.error('Failed to bulk update Redis history', error);
    }
  }
}
