import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { MinesRepository } from './repository/mines.repository';
import { MinesGame } from './types/mines.types';
import { MinesCalculationService } from './service/mines-calculation.service';
import { MinesGameFactory } from './factory/mines-game.factory';
import { MinesValidationService } from './service/mines-validation.service';
import { MinesPersistenceService } from './service/mines-persistence.service';
import { SharedUserGamesService } from 'src/shared/user/games/shared-user-games.service';
import { GameOutcome } from '@prisma/client';
import { RedisService } from 'src/provider/redis/redis.service';
import { VerifyMinesGameDto } from './dto/verify-game.dto';

@Injectable()
export class MinesGameService {
  private readonly logger = new Logger(MinesGameService.name);

  constructor(
    private readonly repo: MinesRepository,
    private readonly calculator: MinesCalculationService,
    private readonly factory: MinesGameFactory,
    private readonly validator: MinesValidationService,
    private readonly persistence: MinesPersistenceService,
    private readonly sharedUserGames: SharedUserGamesService,
    private readonly redisService: RedisService,
  ) {}

  async createGame(
    betAmount: number,
    username: string,
    mines: number,
    size: 25 | 16,
  ): Promise<
    Omit<MinesGame, 'betId' | 'mineMask' | 'revealedMask' | 'serverSeed'>
  > {
    this.validator.validateGameParams(betAmount, mines, size);
    return await this.factory.createNewGame(betAmount, username, mines, size);
  }

  async revealTile(username: string, gameId: string, tile: number) {
    const game = await this.repo.getGame(gameId);
    this.validator.validateGameAccess(game, username);
    this.validator.validateTileReveal(game, tile);

    const bit = 1 << tile;
    const newMask = game.revealedMask | bit;
    const hitMine = (game.mineMask & bit) !== 0;

    const tilesRevealed = this.calculator.countBits(newMask);
    const gemsLeft = game.grid - game.mines - tilesRevealed;

    let active = true;
    let multiplier = game.multiplier;
    let outcome = game.outcome;

    if (hitMine) {
      active = false;
      outcome = 'LOST';
    } else {
      multiplier = this.calculator.calculateMultiplier(
        game.mines,
        game.grid,
        tilesRevealed,
      );

      if (gemsLeft === 0) {
        active = false;
        outcome = 'WON';
      }
    }

    const updated = await this.repo.atomicRevealTile(gameId, bit, tile, {
      active,
      multiplier,
      gemsLeft,
      outcome,
    });

    if (!updated) {
      throw new BadRequestException('Tile reveal failed - game state changed');
    }
    if (!active) {
      await this.repo.deleteGame(game.gameId, username);
      console.log(`
      Game ended for user ${username}, gameId ${game.gameId}, outcome: ${outcome}
      ${JSON.stringify(game)}  
        `);

      if (game.betId) {
        const completedAt = new Date();
        const payout = outcome === 'WON' ? game.betAmount * multiplier : 0;
        const profit = payout - game.betAmount;
        await this.persistence.updateGame(game.betId, game, {
          outcome,
          multiplier,
          completedAt,
          payout,
          profit,
          revealedTiles: this.calculator.maskToTileArray(newMask),
        });
      }
      if (outcome === 'WON') {
        this.logger.log(
          `User ${username} won game ${game.gameId} with multiplier ${multiplier}`,
        );
        this.redisService.incrementBalance(
          username,
          game.betAmount * multiplier,
        );
      }
      this.sharedUserGames
        .removeActiveGame(username, game.gameId)
        .catch((err) => {
          this.logger.error(
            `Failed to remove active game cache for user ${username} and game ${game.gameId}:`,
            err,
          );
        });
    }

    return {
      hitMine,
      active,
      revealedTile: tile,
      multiplier: !hitMine ? multiplier : undefined,
      serverSeed: !active ? game.serverSeed : undefined,
      minesPositions: !active
        ? this.calculator.maskToTileArray(game.mineMask)
        : undefined,
      wonBalance:
        !active && !hitMine ? game.betAmount * multiplier : -game.betAmount,
    };
  }

  async cashout(username: string, gameId: string) {
    const game = await this.repo.getGame(gameId);
    this.validator.validateGameAccess(game, username);
    this.validator.validateCashout(game);

    const updated = await this.repo.atomicUpdateIfActive(gameId, {
      active: false,
      outcome: 'CASHED_OUT',
    });

    if (!updated) {
      throw new BadRequestException('Cashout failed - game already ended');
    }

    await this.repo.deleteGame(game.gameId, username);

    this.sharedUserGames
      .removeActiveGame(username, game.gameId)
      .catch((err) => {
        this.logger.error(
          `Failed to remove active game cache for user ${username} and game ${game.gameId}:`,
          err,
        );
      });

    const completedAt = new Date();
    const winnings = game.betAmount * game.multiplier;
    const revealedTiles = this.calculator.maskToTileArray(game.revealedMask);
    const lastTile = revealedTiles[revealedTiles.length - 1] || null;
    if (game.betId) {
      const profit = winnings - game.betAmount;

      this.persistence.updateGame(game.betId, game, {
        outcome: GameOutcome.CASHED_OUT,
        multiplier: game.multiplier,
        completedAt,
        payout: winnings,
        profit,
        revealedTiles: this.calculator.maskToTileArray(game.revealedMask),
        cashoutTile: lastTile,
      });
    }
    this.logger.log(
      `Incrementing balance for user ${username} after cashout for game ${game.gameId} with winnings ${winnings}`,
    );
    this.redisService.incrementBalance(username, winnings);
    return {
      cashedOut: true,
      winnings,
      multiplier: game.multiplier,
      serverSeed: game.serverSeed,
      minesPositions: this.calculator.maskToTileArray(game.mineMask),
      lastTile,
    };
  }

  async verifyGame(username: string, dto: VerifyMinesGameDto) {
    const { serverSeed, clientSeed, nonce, mines, gridSize } = dto;

    try {
      // Regenerate the mine positions using the same algorithm
      const regeneratedMineMask = this.calculator.generateMineMask(
        serverSeed,
        clientSeed,
        nonce,
        gridSize,
        mines,
      );

      // Convert mask to array of positions for readability
      const minePositions =
        this.calculator.maskToTileArray(regeneratedMineMask);

      // Verify the correct number of mines were generated
      if (minePositions.length !== mines) {
        throw new Error(
          `Mine generation mismatch: expected ${mines}, got ${minePositions.length}`,
        );
      }

      this.logger.log(
        `Verification for user ${username}: serverSeed=${serverSeed.substring(0, 8)}..., ` +
          `clientSeed=${clientSeed}, nonce=${nonce}, mines=${mines}, gridSize=${gridSize}`,
      );

      return {
        verified: true,
        message:
          'Game successfully verified. Mine positions were generated using provably fair algorithm.',
        data: {
          minePositions,
          gridSize,
          mines,
          serverSeed,
          clientSeed,
          nonce,
        },
      };
    } catch (error) {
      this.logger.error(
        `Verification failed for user ${username}: ${error.message}`,
        error.stack,
      );

      throw new BadRequestException(`Verification failed: ${error.message}`);
    }
  }

  async getActiveGame(username: string) {
    const game = await this.repo.getUserActiveGame(username);
    if (!game) return null;

    const { serverSeed, revealedMask, mineMask, ...rest } = game;
    return { ...rest };
  }
}
