import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RedisService } from 'src/provider/redis/redis.service';
import { MinesCalculationService } from '../service/mines-calculation.service';
import { SharedUserGamesService } from 'src/shared/user/games/shared-user-games.service';

import { MinesRepository } from '../repository/mines.repository';
import { SeedManagementService } from '../../seed-managment/seed-managment.service';
import { MinesGame } from '../types/mines.types';
import { MinesPersistenceService } from '../service/mines-persistence.service';
import { GameOutcome } from '@prisma/client';

@Injectable()
export class MinesGameFactory {
  private readonly logger = new Logger(MinesGameFactory.name);

  constructor(
    private readonly repo: MinesRepository,
    private readonly redisService: RedisService,
    private readonly seedManagement: SeedManagementService,
    private readonly calculator: MinesCalculationService,
    private readonly sharedUserGames: SharedUserGamesService,
    private readonly persistence: MinesPersistenceService,
  ) {}

  async createNewGame(
    betAmount: number,
    username: string,
    mines: number,
    size: 25 | 16,
  ): Promise<
    Omit<MinesGame, 'betId' | 'mineMask' | 'revealedMask' | 'serverSeed'>
  > {
    const gameId = this.generateGameId();

    try {
      await this.sharedUserGames.addActiveGame(username, {
        gameType: 'MINES',
        gameId,
      });

      const userSeed = await this.seedManagement.getUserSeed(username);
      const nonce = await this.seedManagement.getAndIncrementNonce(
        username,
        'MINES',
      );

      const result = await this.redisService.atomicCreateMinesGame(
        username,
        betAmount,
        gameId,
        JSON.stringify({
          id: gameId,
          mines,
          mineMask: 0,
          revealedTiles: [],
          gemsLeft: size - mines,
          grid: size,
          betAmount,
          revealedMask: 0,
          active: true,
          creatorUsername: username,
          serverSeed: userSeed.activeServerSeed,
          serverSeedHash: userSeed.activeServerSeedHash,
          clientSeed: userSeed.activeClientSeed,
          nonce,
          multiplier: 1,
        }),
      );

      if (!result.success) {
        throw this.handleCreationError(result.error || '');
      }

      const mineMask = this.calculator.generateMineMask(
        userSeed.activeServerSeed,
        userSeed.activeClientSeed,
        nonce,
        size,
        mines,
      );

      await this.repo.updateGame(gameId, { mineMask, nonce });
      this.seedManagement.updateSeedUsage(username);

      let gameData: Omit<MinesGame, 'betId'> = {
        gameId: gameId,
        mines,
        mineMask,
        revealedMask: 0,
        revealedTiles: [],
        gemsLeft: size - mines,
        grid: size,
        betAmount,
        active: true,
        creatorUsername: username,
        serverSeed: userSeed.activeServerSeed,
        serverSeedHash: userSeed.activeServerSeedHash,
        clientSeed: userSeed.activeClientSeed,
        nonce,
        multiplier: 1,
        outcome: GameOutcome.PLAYING,
      };

      this.persistence
        .backupGame(gameId, username, gameData)
        .then(async (betId) => {
          await this.repo.updateGame(gameId, { betId });
        })
        .catch((err) => {
          this.logger.error(`Async backup failed for game ${gameId}:`, err);
        });

      return {
        gameId: gameId,
        mines,
        revealedTiles: [],
        gemsLeft: size - mines,
        grid: size,
        betAmount,
        active: true,
        creatorUsername: username,
        serverSeedHash: userSeed.activeServerSeedHash,
        clientSeed: userSeed.activeClientSeed,
        nonce,
        multiplier: 1,
        outcome: 'PLAYING',
      };
    } catch (err) {
      await this.sharedUserGames.removeActiveGame(username, gameId);
      throw err;
    }
  }

  private generateGameId(): string {
    const timestamp = Date.now();
    const uuid = randomUUID().split('-')[0];
    return `MINES-${timestamp}-${uuid}`;
  }

  private handleCreationError(error: string): Error {
    if (error === 'ACTIVE_GAME_EXISTS') {
      return new ConflictException('You already have an active game.');
    }
    if (error === 'INSUFFICIENT_BALANCE') {
      return new BadRequestException('Insufficient balance.');
    }
    return new BadRequestException('Game creation failed.');
  }
}
