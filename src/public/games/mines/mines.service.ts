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
import { MinesHistoryService } from './service/mines-history.service';
import { MinesPersistenceService } from './service/mines-persistence.service';
import { SharedUserGamesService } from 'src/shared/user/games/shared-user-games.service';
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

      if (outcome === 'WON') {
        this.persistence.updateGame(game.betId, game, {
          outcome: 'WON',
          multiplier,
        });
      } else if (outcome === 'LOST') {
        this.persistence.updateGame(game.betId, game, {
          outcome: 'LOST',
          multiplier: 0,
        });
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
    this.persistence.updateGame(game.betId, game, {
      outcome: 'CASHED_OUT',
      multiplier: game.multiplier,
    });
    const winnings = game.betAmount * game.multiplier;
    const revealedTiles = this.calculator.maskToTileArray(game.revealedMask);
    const lastTile = revealedTiles[revealedTiles.length - 1] || null;

    return {
      cashedOut: true,
      winnings,
      multiplier: game.multiplier,
      serverSeed: game.serverSeed,
      minesPositions: this.calculator.maskToTileArray(game.mineMask),
      lastTile,
    };
  }

  async getActiveGame(username: string) {
    const game = await this.repo.getUserActiveGame(username);
    if (!game) return null;

    const { serverSeed, revealedMask, mineMask, ...rest } = game;
    return { ...rest };
  }
}
