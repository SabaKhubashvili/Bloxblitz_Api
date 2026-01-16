import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomBytes, createHmac, createHash } from 'crypto';
import { MinesRepository } from './mines.repository';
import { MinesGame } from './types/mines.types';
import { UserRepository } from 'src/user/user.repository';
import { PerfTracker } from 'src/utils/perfomance/perfomance.tracker';

@Injectable()
export class MinesService {
  private readonly logger = new Logger(MinesService.name);
  
  constructor(
    private readonly repo: MinesRepository,
    private readonly userRepo: UserRepository,
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
      // 1️⃣ Fetch clientSeed from Redis cache
      const clientSeed = await this.userRepo.getCachedClientSeed(username);

      if (!clientSeed) {
        throw new BadRequestException(
          'Client seed not found. Please re-login.',
        );
      }
      this.logger.debug(perf.step('getCachedClientSeed'));

      // 2️⃣ Generate server seed and hash it
      const id = randomBytes(8).toString('hex');
      const serverSeed = randomBytes(32).toString('hex');
      const serverSeedHash = createHash('sha256')
        .update(serverSeed)
        .digest('hex');

      this.logger.debug(perf.step('local compute'));

      // 3️⃣ Get nonce atomically from Redis
      const result = await this.repo.redis.atomicCreateMinesGame(
        username,
        betAmount,
        id,
        JSON.stringify({
          id,
          mines,
          mineMask: 0, // Will be set after nonce is obtained
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
          nonce: 0, 
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

      // 4️⃣ NOW generate mineMask with the correct nonce from Redis
      const nonce = result.nonce!;
      const mineMask = this.generateMineMask(
        serverSeed,
        clientSeed,
        nonce,
        size,
        mines,
      );

      // 5️⃣ Update game with the generated mineMask
      await this.repo.updateGame(id, { 
        mineMask, 
        nonce 
      });

      // Return safe game data (hide sensitive fields)
      return {
        id,
        mines,
        revealedTiles: [],
        gemsLeft: size - mines,
        grid: size,
        betAmount,
        active: true,
        creatorUsername: username,
        serverSeedHash, // Only return hash, not the actual seed
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
      throw new BadRequestException(`Invalid tile index. Must be 0-${game.grid - 1}`);
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

    if (hitMine) {
      // Hit mine - game over
      active = false;
      gameResult = 'lost';
    } else {
      // Safe tile - calculate new multiplier
      multiplier = this.calculateMultiplier(
        game.mines,
        totalTiles,
        tilesRevealed,
      );

      // Check if won (all safe tiles revealed)
      if (gemsLeft === 0) {
        active = false;
        gameResult = 'won';

        // Credit winnings
        await this.userRepo.incrementUserBalance(
          username,
          game.betAmount * multiplier,
        );
      }
    }

    // Atomic update with race condition protection
    const updated = await this.repo.atomicRevealTile(gameId, bit, tile, {
      active,
      multiplier,
      gemsLeft,
      gameResult,
    });

    if (!updated) throw new BadRequestException('Tile reveal failed - game state changed');

    // Clear active game if game ended
    if (!active) {
      await this.repo.clearActiveGame(username);
    }

    return {
      hitMine,
      active,
      revealedTile: tile,
      multiplier: !hitMine ? multiplier : undefined,
      serverSeed: !active ? game.serverSeed : undefined, // Only reveal on game end
      minesPositions: !active ? this.maskToTileArray(game.mineMask) : undefined,
      wonBalance: !active && !hitMine ? game.betAmount * multiplier : -game.betAmount ,
    };
  }

  /* ---------------- CASHOUT & ACTIVE GAME ---------------- */
  async cashout(username: string, gameId: string) {
    const game = await this.repo.getGame(gameId);
    if (!game) throw new BadRequestException('Game not found');

    if (game.creatorUsername !== username)
      throw new BadRequestException('Not your game');

    if (!game.active) throw new BadRequestException('Game already ended');

    // Prevent cashout without revealing any tiles
    if (this.countBits(game.revealedMask) === 0) {
      throw new BadRequestException('Must reveal at least one tile before cashing out');
    }

    // Atomic update with race condition protection
    const updated = await this.repo.atomicUpdateIfActive(gameId, {
      active: false,
      gameResult: 'cashed_out',
    });

    if (!updated) throw new BadRequestException('Cashout failed - game already ended');

    await this.repo.clearActiveGame(username);

    // Credit winnings
    const winnings = game.betAmount * game.multiplier;
    await this.userRepo.incrementUserBalance(username, winnings);

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
    if (!game) {
      return null;
    }
    
    // Hide sensitive data
    const { serverSeed, revealedMask, mineMask, ...rest } = game;
    return { ...rest };
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

    // Validation
    if (safeTiles <= 0 || tilesRevealed > safeTiles) {
      throw new Error('Invalid game state for multiplier calculation');
    }

    let multiplier = 1;

    // Calculate probability-based multiplier
    for (let i = 0; i < tilesRevealed; i++) {
      const remainingSafeTiles = safeTiles - i;
      const remainingTotalTiles = totalTiles - i;
      multiplier *= remainingTotalTiles / remainingSafeTiles;
    }

    // Apply house edge
    multiplier *= 0.99;
    
    // Cap maximum multiplier
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

  /**
   * Generates a provably fair mine mask using HMAC-SHA256
   * 
   * @param serverSeed - Random server seed
   * @param clientSeed - Client-provided seed
   * @param nonce - Unique game nonce
   * @param size - Grid size (16 or 25)
   * @param mines - Number of mines to place
   * @returns Bitmask representing mine positions
   */
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

    // Generate HMAC with proper format: HMAC(serverSeed, clientSeed:nonce)
    const combinedSeed = `${clientSeed}:${nonce}`;
    let currentHash = createHmac('sha256', serverSeed)
      .update(combinedSeed)
      .digest('hex');

    while (positions.size < mines) {
      // Process hash in 4-character chunks (2 bytes = 16 bits)
      for (
        let i = 0;
        i < currentHash.length - 3 && positions.size < mines;
        i += 4
      ) {
        const chunk = currentHash.substring(i, i + 4);
        const value = parseInt(chunk, 16);
        
        // Reject values that would cause modulo bias
        // Calculate the largest multiple of size that fits in 16 bits
        const maxValue = Math.floor(65536 / size) * size;
        
        if (value < maxValue) {
          const position = value % size;
          positions.add(position);
        }
      }

      // If we need more positions, chain hash
      if (positions.size < mines) {
        currentHash = createHash('sha256')
          .update(currentHash + cursor.toString())
          .digest('hex');
        cursor++;
      }

      // Safety check to prevent infinite loop
      if (cursor > 1000) {
        throw new Error('Failed to generate mine positions - exceeded max iterations');
      }
    }

    // Convert Set to bitmask
    let mask = 0;
    positions.forEach((pos) => {
      mask |= 1 << pos;
    });

    // Verify correct number of mines
    const actualMines = this.countBits(mask);
    if (actualMines !== mines) {
      throw new Error(`Mine generation error: expected ${mines}, got ${actualMines}`);
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