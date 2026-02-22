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
import { GameStatus, GameType } from '@prisma/client';
import { RedisService } from 'src/provider/redis/redis.service';
import { VerifyMinesGameDto } from './dto/verify-game.dto';

import { RedisKeys } from 'src/provider/redis/redis.keys';
import { UserRepository } from '../../user/user.repository';
import { LevelingService } from '../../leveling/leveling.service';

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
    private readonly userRepository: UserRepository,
    private readonly redis: RedisService,
    private readonly levelingService: LevelingService,
  ) { }

  async createGame(
    betAmount: number,
    username: string,
    profilePicture: string,
    mines: number,
    size: 16 | 25 | 36 | 64 | 100,
  ): Promise<
    Omit<MinesGame, 'betId' | 'mineMask' | 'revealedMask' | 'serverSeed'>
  > {
    this.validator.validateGameParams(betAmount, mines, size);
    return await this.factory.createNewGame(
      betAmount,
      username,
      profilePicture,
      mines,
      size,
    );
  }

  async revealTile(username: string, gameId: string, tile: number) {
    try {
      this.logger.log(
        `User ${username} is revealing tile ${tile} in game ${gameId}`,
      );

      // --- Acquire locks ---
      if (!(await this.repo.lockMinesGame(gameId))) {
        throw new ConflictException(
          'Game is being processed, please try again',
        );
      }
      if (!(await this.repo.lockGameTile(gameId, String(tile)))) {
        throw new ConflictException(
          'Game is being processed, please try again',
        );
      }

      // --- Validate game state ---
      const game = await this.repo.getGame(gameId);
      if (!game || game.status === GameStatus.INITIALIZING) {
        throw new ConflictException('Game is initializing');
      }
      this.validator.validateGameAccess(game, username);
      this.validator.validateTileReveal(game, tile);

      // --- Compute tile result ---
      const bit = 1n << BigInt(tile);
      const newMask = BigInt(game.revealedMask) | bit;
      const hitMine = (BigInt(game.mineMask) & bit) !== 0n;
      const tilesRevealed = this.calculator.countBits(newMask);
      const gemsLeft = game.grid - game.mines - tilesRevealed;

      const multiplier = hitMine
        ? game.multiplier
        : this.calculator.calculateMultiplier(
          game.mines,
          game.grid,
          tilesRevealed,
        );
      const outcome = hitMine ? GameStatus.LOST : gemsLeft === 0 ? GameStatus.WON : game.status;
      const active = outcome === game.status;
      const status = active ? GameStatus.PLAYING : outcome === GameStatus.WON ? GameStatus.WON : GameStatus.LOST;

      // --- Persist tile reveal ---
      const updated = await this.repo.atomicRevealTile(gameId, bit, tile, {
        active,
        multiplier,
        gemsLeft,
        status,
        revealedMask: newMask.toString(),
      });
      if (!updated) {
        throw new BadRequestException(
          'Tile reveal failed - game state changed',
        );
      }

      // --- Handle game end ---
      if (!active) {
        const payout = outcome === GameStatus.WON ? game.betAmount * multiplier : 0;
        const profit = payout - game.betAmount;

        await this.repo.deleteGame(game.gameId, username);

        if (game.betId) {
          this.persistence
            .updateGame(game.betId, game.gameHistoryId!, game, {
              status: outcome === GameStatus.WON ? GameStatus.CASHED_OUT : GameStatus.LOST,
              multiplier,
              payout,
              profit,
              completedAt: new Date(),
              revealedTiles: this.calculator.maskToTileArray(newMask),
              minesHit: hitMine ? tile : undefined,
            })
            .then(() =>
              this.logger.log(
                `Mines record updated for betId ${game.betId}, outcome: ${outcome}`,
              ),
            )
            .catch((err) =>
              this.logger.error(
                `Failed to update mines record for betId ${game.betId}:`,
                err,
              ),
            );
        }

        this.userRepository
          .incrementGameStats(
            username,
            game.betAmount,
            multiplier,
            GameType.MINES,
            outcome === 'WON',
          )
          .catch((err) =>
            this.logger.error(
              `Failed to increment game stats for ${username}:`,
              err,
            ),
          );

        if (outcome === 'WON') {
          this.logger.log(
            `User ${username} won game ${game.gameId} with multiplier ${multiplier}`,
          );
          this.redisService.incrementBalance(
            username,
            game.betAmount * multiplier,
          );
        }

         this.levelingService.awardXpFromWager(
          username,
          game.betAmount,
          GameType.MINES,
        ).then(async (xpResponse) => {
          await this.redis.pubClient.publish(
            'bet.placed',
            JSON.stringify({
              username,
              game: GameType.MINES,
              profilePicture: game.creatorProfilePicture,
              amount: game.betAmount,
              profit,
              multiplier,
              createdAt: Date.now(),
              level: xpResponse.newLevel,
            }),
          );
        });



        await Promise.allSettled([
          this.redisService.del(RedisKeys.user.profile(username)),
          this.redisService.del(RedisKeys.user.publicProfile(username)),
          this.sharedUserGames.removeActiveGame(username, game.gameId),
        ]);
      }

      // --- Build response ---
      return {
        hitMine,
        active,
        revealedTile: tile,
        multiplier: !hitMine ? multiplier : undefined,
        serverSeed: !active ? game.serverSeed : undefined,
        minesPositions: !active
          ? this.calculator.maskToTileArray(BigInt(game.mineMask))
          : undefined,
        wonBalance:
          !active && !hitMine ? game.betAmount * multiplier : -game.betAmount,
      };
    } catch (error) {
      this.logger.error(
        `Error revealing tile ${tile} for user ${username} in game ${gameId}: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await this.repo.unlockMinesGame(gameId);
      await this.repo.unlockGameTile(gameId, String(tile));
      this.logger.log(`Released locks for game ${gameId}, tile ${tile}`);
    }
  }
  async cashout(username: string, gameId: string) {
    try {
      this.logger.log(
        `Attempting to cashout game ${gameId} for user ${username}`,
      );

      // --- Acquire lock ---
      if (!(await this.repo.lockMinesGame(gameId))) {
        throw new ConflictException(
          'Game is being processed, please try again',
        );
      }
      this.logger.log(`Acquired lock for cashout on game ${gameId}`);

      // --- Validate game state ---
      const game = await this.repo.getGame(gameId);
      if (!game || game.status === 'INITIALIZING' || game.status === 'ENDING') {
        throw new ConflictException('Game is being processed');
      }
      if (game.status !== 'PLAYING') {
        throw new BadRequestException('Cannot cashout inactive game');
      }
      this.validator.validateGameAccess(game, username);
      this.validator.validateCashout(game);

      // --- Persist cashout ---
      const updated = await this.repo.atomicUpdateIfActiveAndStatus(
        gameId,
        'PLAYING',
        {
          active: false,
          status: GameStatus.CASHED_OUT,
        },
      );
      if (!updated) {
        throw new BadRequestException('Cashout failed - game already ended');
      }

      // --- Compute cashout values ---
      const winnings = game.betAmount * game.multiplier;
      const profit = winnings - game.betAmount;
      const revealedTiles = this.calculator.maskToTileArray(
        BigInt(game.revealedMask),
      );
      const lastTile = revealedTiles[revealedTiles.length - 1] ?? null;

      // --- Cleanup & side effects ---
      await this.repo.deleteGame(game.gameId, username);

      if (game.betId) {
        this.persistence
          .updateGame(game.betId, game.gameHistoryId!, game, {
            status: GameStatus.CASHED_OUT,
            multiplier: game.multiplier,
            completedAt: new Date(),
            payout: winnings,
            profit,
            revealedTiles,
            cashoutTile: lastTile,
          })
          .catch((err) =>
            this.logger.error(
              `Failed to update mines record for betId ${game.betId}:`,
              err,
            ),
          );

        this.levelingService
          .awardXpFromWager(username, game.betAmount, GameType.MINES)
          .then(async (xpResponse) => {
            await this.redis.pubClient.publish(
              'bet.placed',
              JSON.stringify({
                username,
                game: GameType.MINES,
                profilePicture: game.creatorProfilePicture,
                amount: game.betAmount,
                profit,
                multiplier: game.multiplier,
                createdAt: Date.now(),
                level: xpResponse.newLevel,
              }),
            );
          })
          .catch((err) =>
            this.logger.error(`Failed to award XP for user ${username}:`, err),
          );
      }

      this.logger.log(
        `Incrementing balance for user ${username} after cashout for game ${game.gameId} with winnings ${winnings}`,
      );
      this.redisService.incrementBalance(username, winnings);

      this.userRepository
        .incrementGameStats(
          username,
          game.betAmount,
          game.multiplier,
          GameType.MINES,
          true,
        )
        .then(() =>
          this.logger.log(
            `Incremented games won for user ${username} after cashout for game ${game.gameId}`,
          ),
        )
        .catch((err) =>
          this.logger.error(
            `Failed to increment games won for user ${username} after game ${game.gameId}:`,
            err,
          ),
        );

      await Promise.allSettled([
        this.redisService.del(RedisKeys.user.profile(username)),
        this.redisService.del(RedisKeys.user.publicProfile(username)),
        this.sharedUserGames.removeActiveGame(username, game.gameId),
      ]);

      // --- Build response ---
      return {
        cashedOut: true,
        winnings,
        multiplier: game.multiplier,
        serverSeed: game.serverSeed,
        minesPositions: this.calculator.maskToTileArray(BigInt(game.mineMask)),
        lastTile,
      };
    } catch (err) {
      this.logger.error(
        `Error cashing out game ${gameId} for user ${username}: ${err.message}`,
        err.stack,
      );
      throw err;
    } finally {
      await this.repo.unlockMinesGame(gameId);
    }
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
    console.log(game);

    const { serverSeed, revealedMask, mineMask, ...rest } = game;
    return { ...rest };
  }
}
