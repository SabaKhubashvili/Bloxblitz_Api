import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomBytes, createHmac, createHash } from 'crypto';
import { MinesRepository } from './mines.repository';
import { MinesGame } from './types/mines.types';
import { UserRepository } from 'src/public/user/user.repository';
import { PerfTracker } from 'src/utils/perfomance/perfomance.tracker';
import { PrismaService } from 'src/prisma/prisma.service';
import { SeedManagementService } from '../seed-managment/seed-managment.service';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/client';
import { BetHistoryService } from 'src/private/user/bet-history/private-bet-history.service';
import { UpdateBetHistoryDto } from 'src/private/user/bet-history/dto/update-bet-history.dto';
import { SharedUserGamesService } from 'src/shared/user/games/shared-user-games.service';

@Injectable()
export class MinesService {
  private readonly logger = new Logger(MinesService.name);

  constructor(
    private readonly repo: MinesRepository,
    private readonly userRepo: UserRepository,
    private readonly prisma: PrismaService,
    private readonly seedManagement: SeedManagementService,
    private readonly betHistoryService: BetHistoryService,
    private readonly sharedUserGamesService: SharedUserGamesService,
  ) {}

  /* ---------------- CREATE GAME ---------------- */
  async createGame(
    betAmount: number,
    username: string,
    mines: number,
    size: 25 | 16,
  ): Promise<Omit<MinesGame, 'mineMask' | 'revealedMask' | 'serverSeed'>> {
    const perf = new PerfTracker();

    // Validate inputs
    if (betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }
    if (mines <= 0 || mines >= size) {
      throw new BadRequestException(`Mines must be between 1 and ${size - 1}`);
    }

    try {
      // 1️⃣ Get user's shared seed data from SeedManagementService
      const userSeed = await this.seedManagement.getUserSeed(username);
      this.logger.debug(perf.step('getUserSeed'));

      // 2️⃣ Get and increment nonce for MINES game type
      const nonce = await this.seedManagement.getAndIncrementNonce(
        username,
        'MINES',
      );
      this.logger.debug(perf.step('getAndIncrementNonce'));

      // 3️⃣ Generate game ID
      const id = randomBytes(8).toString('hex');

      // 4️⃣ Use the SHARED server seed from SeedManagementService
      const serverSeed = userSeed.activeServerSeed;
      const serverSeedHash = userSeed.activeServerSeedHash;
      const clientSeed = userSeed.activeClientSeed;

      this.logger.debug(perf.step('seed preparation'));

      // 5️⃣ Create game in Redis with atomic balance deduction
      const result = await this.repo.redis.atomicCreateMinesGame(
        username,
        betAmount,
        id,
        JSON.stringify({
          id,
          mines,
          mineMask: 0,
          revealedTiles: [],
          gemsLeft: size - mines,
          grid: size,
          betAmount,
          revealedMask: 0,
          active: true,
          creatorUsername: username,
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          multiplier: 1,
        }),
      );
      this.logger.debug(perf.step('atomicCreateMinesGame'));

      if (!result.success) {
        if (result.error === 'ACTIVE_GAME_EXISTS') {
          throw new ConflictException('You already have an active game.');
        }
        if (result.error === 'INSUFFICIENT_BALANCE') {
          throw new BadRequestException('Insufficient balance.');
        }
        throw new BadRequestException('Game creation failed.');
      }

      // 6️⃣ Generate mineMask using shared server seed
      const mineMask = this.generateMineMask(
        serverSeed,
        clientSeed,
        nonce,
        size,
        mines,
      );

      // 7️⃣ Update game with the generated mineMask
      await this.repo.updateGame(id, {
        mineMask,
        nonce,
      });

      // 8️⃣ Update seed usage through SeedManagementService
      this.seedManagement.updateSeedUsage(username);

      // 🔥 ASYNC BACKUP - Save to GameHistory table
      this.backupGameToDatabase(id, username, {
        id,
        mines,
        mineMask,
        revealedMask: 0,
        revealedTiles: [],
        gemsLeft: size - mines,
        grid: size,
        betAmount,
        active: true,
        creatorUsername: username,
        serverSeed,
        serverSeedHash,
        clientSeed,
        nonce,
        multiplier: 1,
      }).catch((err) => {
        this.logger.error(`Async backup failed for game ${id}:`, err);
      });
      this.sharedUserGamesService.addActiveGame(username, {
        gameType: 'MINES',
        gameId: id,
      });

      // Return safe game data (no server seed revealed)
      return {
        id,
        mines,
        revealedTiles: [],
        gemsLeft: size - mines,
        grid: size,
        betAmount,
        active: true,
        creatorUsername: username,
        serverSeedHash,
        clientSeed,
        nonce,
        multiplier: 1,
      };
    } catch (err) {
      this.logger.error('Error creating mines game', err);
      throw err;
    }
  }

  async revealTile(username: string, gameId: string, tile: number) {
    const game = await this.repo.getGame(gameId);
    if (!game) throw new BadRequestException('Game not found');

    if (game.creatorUsername !== username)
      throw new BadRequestException('Not your game');

    if (!game.active) throw new BadRequestException('Game already ended');

    // Validate tile index
    if (tile < 0 || tile >= game.grid) {
      throw new BadRequestException(
        `Invalid tile index. Must be 0-${game.grid - 1}`,
      );
    }

    const bit = 1 << tile;

    // Check if already revealed
    if (game.revealedMask & bit)
      throw new BadRequestException('Tile already revealed');

    const newMask = game.revealedMask | bit;
    const hitMine = (game.mineMask & bit) !== 0;

    const tilesRevealed = this.countBits(newMask);
    const totalTiles = game.grid;
    const safeTiles = totalTiles - game.mines;
    const gemsLeft = safeTiles - tilesRevealed;

    let active = true;
    let multiplier = game.multiplier;
    let gameResult = game.gameResult;
    let outcome: 'WON' | 'LOST' | 'CASHED_OUT' | undefined;

    if (hitMine) {
      active = false;
      gameResult = 'lost';
      outcome = 'LOST';

      this.sharedUserGamesService.removeActiveGame(username, gameId);
    } else {
      multiplier = this.calculateMultiplier(
        game.mines,
        totalTiles,
        tilesRevealed,
      );

      if (gemsLeft === 0) {
        active = false;
        gameResult = 'won';
        outcome = 'WON';
        await this.userRepo.incrementUserBalance(
          username,
          game.betAmount * multiplier,
        );
        this.sharedUserGamesService.removeActiveGame(username, gameId);
      }
    }

    // Atomic update with race condition protection
    const updated = await this.repo.atomicRevealTile(gameId, bit, tile, {
      active,
      multiplier,
      gemsLeft,
      gameResult,
    });

    if (!updated)
      throw new BadRequestException('Tile reveal failed - game state changed');

    if (!active) {
      await this.repo.clearActiveGame(username);
    }

    // 🔥 ASYNC BACKUP - Update database in background
    this.updateGameHistory(gameId, game, {
      revealedTiles: this.maskToTileArray(newMask),
      active,
      multiplier,
      outcome,
      completedAt: !active ? new Date() : undefined,
      payout: !active ? (hitMine ? 0 : game.betAmount * multiplier) : undefined,
      profit: !active
        ? hitMine
          ? -game.betAmount
          : game.betAmount * multiplier - game.betAmount
        : undefined,
      cashoutTile: !active && !hitMine ? tile : null,
    }).catch((err) => {
      this.logger.error(`Failed to update game history for ${gameId}:`, err);
    });

    // Update statistics if game ended
    if (!active && outcome) {
      this.updateGameStatistics(
        username,
        game.betAmount,
        multiplier,
        outcome,
      ).catch((err) => {
        this.logger.error(`Failed to update statistics:`, err);
      });
    }

    return {
      hitMine,
      active,
      revealedTile: tile,
      multiplier: !hitMine ? multiplier : undefined,
      serverSeed: !active ? game.serverSeed : undefined,
      minesPositions: !active ? this.maskToTileArray(game.mineMask) : undefined,
      wonBalance:
        !active && !hitMine ? game.betAmount * multiplier : -game.betAmount,
    };
  }

  /* ---------------- CASHOUT & ACTIVE GAME ---------------- */
  async cashout(username: string, gameId: string) {
    const game = await this.repo.getGame(gameId);
    if (!game) throw new BadRequestException('Game not found');

    if (game.creatorUsername !== username)
      throw new BadRequestException('Not your game');

    if (!game.active) throw new BadRequestException('Game already ended');

    if (this.countBits(game.revealedMask) === 0) {
      throw new BadRequestException(
        'Must reveal at least one tile before cashing out',
      );
    }

    const updated = await this.repo.atomicUpdateIfActive(gameId, {
      active: false,
      gameResult: 'cashed_out',
    });

    if (!updated)
      throw new BadRequestException('Cashout failed - game already ended');

    await this.repo.clearActiveGame(username);

    const winnings = game.betAmount * game.multiplier;
    await this.userRepo.incrementUserBalance(username, winnings);

    // Find the last revealed tile
    const revealedTiles = this.maskToTileArray(game.revealedMask);
    const lastTile = revealedTiles[revealedTiles.length - 1] || null;

    // 🔥 ASYNC BACKUP
    this.updateGameHistory(gameId, game, {
      revealedTiles,
      active: false,
      multiplier: game.multiplier,
      outcome: 'CASHED_OUT',
      completedAt: new Date(),
      payout: winnings,
      profit: winnings - game.betAmount,
      cashoutTile: lastTile,
    }).catch((err) => {
      this.logger.error(
        `Failed to update game history for cashout ${gameId}:`,
        err,
      );
    });
    this.sharedUserGamesService.removeActiveGame(username, gameId);
    // Update statistics
    this.updateGameStatistics(
      username,
      game.betAmount,
      game.multiplier,
      'CASHED_OUT',
    ).catch((err) => {
      this.logger.error(`Failed to update statistics:`, err);
    });

    return {
      cashedOut: true,
      winnings,
      multiplier: game.multiplier,
      serverSeed: game.serverSeed,
      minesPositions: this.maskToTileArray(game.mineMask),
    };
  }

  async getActiveGame(username: string) {
    const game = await this.repo.getUserActiveGame(username);
    console.log(game);
    if (!game) {
      return null;
    }

    const { serverSeed, revealedMask, mineMask, ...rest } = game;
    return { ...rest };
  }

  /* ---------------- GAME HISTORY METHODS ---------------- */

  async getUserMinesHistorySimple(username: string, limit = 10) {
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

  /**
   * Get all games for a specific seed (for verification)
   */
  async getGamesForSeed(username: string, serverSeedHash: string) {
    return await this.prisma.gameHistory.findMany({
      where: {
        userUsername: username,
        serverSeedHash: serverSeedHash,
        gameType: 'MINES',
      },
      include: {
        seedRotationHistory: true,
      },
      orderBy: {
        nonce: 'asc',
      },
    });
  }

  /* ---------------- SEED MANAGEMENT PROXY METHODS ---------------- */

  /**
   * Get public seed info (delegates to SeedManagementService)
   */
  async getPublicSeedInfo(username: string) {
    return await this.seedManagement.getPublicSeedInfo(username);
  }

  /**
   * Rotate user's seed pair (delegates to SeedManagementService)
   */
  async rotateSeed(username: string, newClientSeed?: string) {
    return await this.seedManagement.rotateSeed(username, newClientSeed);
  }

  /**
   * Change client seed (delegates to SeedManagementService)
   */
  async changeClientSeed(username: string, newClientSeed: string) {
    return await this.seedManagement.changeClientSeed(username, newClientSeed);
  }

  /**
   * Get seed rotation history (delegates to SeedManagementService)
   */
  async getSeedHistory(username: string, limit = 10) {
    return await this.seedManagement.getSeedHistory(username, limit);
  }

  /**
   * Verify a game result (delegates to SeedManagementService)
   */
  async verifyGameResult(
    username: string,
    serverSeedHash: string,
    clientSeed: string,
    nonce: number,
  ) {
    return await this.seedManagement.verifyGameResult(
      username,
      serverSeedHash,
      clientSeed,
      nonce,
    );
  }

  /* ---------------- DATABASE BACKUP METHODS ---------------- */

  /**
   * Backup new game to GameHistory table
   */
  private async backupGameToDatabase(
    gameId: string,
    username: string,
    gameData: MinesGame,
  ): Promise<void> {
    try {
      await this.betHistoryService.add({
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
          minePositions: this.maskToTileArray(gameData.mineMask),
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

      this.logger.log(`Mines game ${gameId} backed up to database`);
    } catch (error) {
      this.logger.error(`Database backup failed for game ${gameId}:`, error);
    }
  }

  /**
   * Update GameHistory as the game progresses
   */
  private async updateGameHistory(
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
        (updateData.gameData as any).minePositions = this.maskToTileArray(
          gameData.mineMask,
        );
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

  /**
   * Update user's game statistics
   */
  private async updateGameStatistics(
    username: string,
    betAmount: number,
    multiplier: number,
    outcome: 'WON' | 'LOST' | 'CASHED_OUT',
  ): Promise<void> {
    try {
      const payout = outcome === 'LOST' ? 0 : betAmount * multiplier;
      const profit = payout - betAmount;

      await this.prisma.userGameStatistics.upsert({
        where: {
          userUsername_gameType: {
            userUsername: username,
            gameType: 'MINES',
          },
        },
        create: {
          userUsername: username,
          gameType: 'MINES',
          totalGames: 1,
          totalWagered: betAmount,
          totalPayout: payout,
          totalProfit: profit,
          gamesWon: outcome === 'WON' ? 1 : 0,
          gamesLost: outcome === 'LOST' ? 1 : 0,
          gamesCashedOut: outcome === 'CASHED_OUT' ? 1 : 0,
          biggestWin: outcome !== 'LOST' ? profit : 0,
          biggestLoss: outcome === 'LOST' ? betAmount : 0,
          highestMultiplier: multiplier,
          currentStreak: outcome === 'LOST' ? -1 : 1,
          longestWinStreak: outcome === 'LOST' ? 0 : 1,
          longestLossStreak: outcome === 'LOST' ? 1 : 0,
          firstGameAt: new Date(),
          lastGameAt: new Date(),
        },
        update: {
          totalGames: { increment: 1 },
          totalWagered: { increment: betAmount },
          totalPayout: { increment: payout },
          totalProfit: { increment: profit },
          gamesWon: outcome === 'WON' ? { increment: 1 } : undefined,
          gamesLost: outcome === 'LOST' ? { increment: 1 } : undefined,
          gamesCashedOut:
            outcome === 'CASHED_OUT' ? { increment: 1 } : undefined,
          lastGameAt: new Date(),
        },
      });

      this.logger.debug(`Statistics updated for ${username}`);
    } catch (error) {
      this.logger.error(`Failed to update statistics for ${username}:`, error);
    }
  }

  /* ---------------- INTERNAL UTILS ---------------- */

  private calculateMultiplier(
    mines: number,
    gridSize: number,
    tilesRevealed: number,
  ): number {
    if (tilesRevealed === 0) {
      return 1;
    }

    const totalTiles = gridSize;
    const safeTiles = totalTiles - mines;

    if (safeTiles <= 0 || tilesRevealed > safeTiles) {
      throw new Error('Invalid game state for multiplier calculation');
    }

    let multiplier = 1;

    for (let i = 0; i < tilesRevealed; i++) {
      const remainingSafeTiles = safeTiles - i;
      const remainingTotalTiles = totalTiles - i;
      multiplier *= remainingTotalTiles / remainingSafeTiles;
    }

    multiplier *= 0.99;
    multiplier = Math.min(multiplier, 1000);

    return parseFloat(multiplier.toFixed(2));
  }

  private maskToTileArray(mask: number): number[] {
    const tiles: number[] = [];
    let pos = 0;
    let tempMask = mask;

    while (tempMask > 0) {
      if (tempMask & 1) {
        tiles.push(pos);
      }
      tempMask >>= 1;
      pos++;
    }

    return tiles;
  }

  private generateMineMask(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    size: 25 | 16,
    mines: number,
  ): number {
    if (mines >= size) {
      throw new BadRequestException(
        `Cannot place ${mines} mines on a ${size}-cell grid`,
      );
    }

    const positions = new Set<number>();
    let cursor = 0;

    const combinedSeed = `${clientSeed}:${nonce}`;
    let currentHash = createHmac('sha256', serverSeed)
      .update(combinedSeed)
      .digest('hex');

    while (positions.size < mines) {
      for (
        let i = 0;
        i < currentHash.length - 3 && positions.size < mines;
        i += 4
      ) {
        const chunk = currentHash.substring(i, i + 4);
        const value = parseInt(chunk, 16);

        const maxValue = Math.floor(65536 / size) * size;

        if (value < maxValue) {
          const position = value % size;
          positions.add(position);
        }
      }

      if (positions.size < mines) {
        currentHash = createHash('sha256')
          .update(currentHash + cursor.toString())
          .digest('hex');
        cursor++;
      }

      if (cursor > 1000) {
        throw new Error(
          'Failed to generate mine positions - exceeded max iterations',
        );
      }
    }

    let mask = 0;
    positions.forEach((pos) => {
      mask |= 1 << pos;
    });

    const actualMines = this.countBits(mask);
    if (actualMines !== mines) {
      throw new Error(
        `Mine generation error: expected ${mines}, got ${actualMines}`,
      );
    }

    return mask;
  }

  private countBits(n: number): number {
    let count = 0;
    while (n) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  }
}
