import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BetHistoryService } from 'src/private/modules/user/bet-history/private-bet-history.service';

import { GameStatus, Prisma } from '@prisma/client';
import { MinesGame } from '../types/mines.types';
import { MinesCalculationService } from './mines-calculation.service';

@Injectable()
export class MinesPersistenceService {
  private readonly logger = new Logger(MinesPersistenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly betHistoryService: BetHistoryService,
    private readonly minesCalculationService: MinesCalculationService,
  ) {}

  async backupGame(
    gameId: string,
    username: string,
    gameData: Omit<MinesGame, 'betId'>,
  ): Promise<{ betId: string | null; gameHistoryId: string }> {
    return await this.backupToDatabase(gameId, username, gameData)
      .then((data) => {
        this.logger.log(`✅ Database backup completed for game ${gameId}`);
        return {betId:data.betId,gameHistoryId:data.gameHistoryId};
      })
      .catch((error) => {
        this.logger.error(`Database backup failed for game ${gameId}:`, error);
        throw error;
      });
  }

  async updateGame(
    gameId: string,
    gameHistoryId: string,
    gameData: MinesGame,
    updates: {
      revealedTiles?: number[];
      active?: boolean;
      multiplier?: number;
      status?: GameStatus;
      completedAt?: Date;
      payout?: number;
      profit?: number;
      minesHit?: number;
      cashoutTile?: number | null;
    },
  ) {
    await this.updateDatabase(gameId,gameHistoryId, gameData, updates);
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
        status: gameData.status,
        finalMultiplier:1,
        payout: 0,

        // Game-specific config stored in JSON
        gameConfig: {
          gridSize: gameData.grid,
          minesCount: gameData.mines,
        },

        // Game-specific data stored in JSON
        gameData: {
          revealedTiles: [],
          minesPositions: this.minesCalculationService.maskToTileArray(
            gameData.mineMask ? BigInt(gameData.mineMask) : 0n,
          ),
        },

        // Financial data
        betAmount: gameData.betAmount,
        profit: -gameData.betAmount,

        seedRotationHistoryId:gameData.seedRotationHistoryId || null,
        startedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`Database backup failed for game ${gameId}:`, error);
      throw error;
    }
  }

  private async updateDatabase(
    betId: string,
    gameHistoryId:string,
    gameData: MinesGame,
    updates: any,
  ): Promise<void> {
    try {
      this.logger.debug(
        `Updating game history for game ${betId}, updates: ${JSON.stringify(updates)}`,
      );

      // Get current game data from database
      const currentGame = await this.prisma.minesBetHistory.findUnique({
        where: { id: betId },
        select: { gameId: true, revealedTiles: true, minePositions:true, cashoutTile: true, createdAt: true, },
      });

      if (!currentGame) {
        this.logger.warn(`Game ${betId} not found in database for update`);
        return;
      }

      const currentGameData = {
        revealedTiles: currentGame.revealedTiles || [],
        minePositions: currentGame.minePositions || [],
        cashoutTile: currentGame.cashoutTile || null,
      }

      // Determine if game is ending
      const isGameEnding = updates.completedAt !== undefined;

      // Prepare gameData JSON field
      const updatedGameData: Prisma.MinesBetHistoryUpdateArgs['data'] = {
        revealedTiles: updates.revealedTiles || currentGameData.revealedTiles,
        minePositions: isGameEnding
          ? this.minesCalculationService.maskToTileArray(gameData.mineMask ? BigInt(gameData.mineMask) : 0n)
          : currentGameData.minePositions,
        cashoutTile:
          updates.cashoutTile !== undefined
            ? updates.cashoutTile
            : currentGameData.cashoutTile,
        minesHit: updates.minesHit !== undefined ? updates.minesHit : null,
        status: updates.status || gameData.status,
      };




      // Perform the update directly with Prisma
      await this.prisma.minesBetHistory.update({
        where: { id: betId },
        data: updatedGameData,
      });
      await this.prisma.gameHistory.update({
        where:{
          id: gameHistoryId
        },
        data:{
          multiplier: updates.multiplier !== undefined ? updates.multiplier : undefined,
          status: updates.status !== undefined ? updates.status : undefined,
          profit: updates.profit !== undefined ? updates.profit : undefined,
        }
    })

      this.logger.debug(`Game history ${betId} updated successfully`);
    } catch (error) {
      this.logger.error(`Failed to update game history for ${betId}:`, error);
    }
  }
}
