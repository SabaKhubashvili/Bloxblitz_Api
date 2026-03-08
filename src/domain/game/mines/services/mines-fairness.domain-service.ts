import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { MineMask } from '../value-objects/mine-mask.vo';

/**
 * Provably fair mine generation using HMAC-SHA256.
 *
 * Each tile's position is determined by a seeded Fisher-Yates shuffle,
 * where the shuffle randomness is derived from HMAC(serverSeed:clientSeed:nonce, position).
 * This allows any party to independently verify the mine layout after the server seed is revealed.
 */
@Injectable()
export class MinesFairnessDomainService {
  generateMineMask(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    gridSize: number,
    mineCount: number,
  ): MineMask {
    const positions = this.generateMinePositions(
      serverSeed,
      clientSeed,
      nonce,
      gridSize,
      mineCount,
    );
    return new MineMask(new Set(positions));
  }

  /**
   * Verifies a completed game by reproducing the mine positions from public seed data.
   * Called after the server seed is revealed at game end.
   */
  verifyGame(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    gridSize: number,
    mineCount: number,
  ): number[] {
    return this.generateMinePositions(serverSeed, clientSeed, nonce, gridSize, mineCount);
  }

  private generateMinePositions(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    gridSize: number,
    mineCount: number,
  ): number[] {
    const tiles = Array.from({ length: gridSize }, (_, i) => i);
    const combinedSeed = `${serverSeed}:${clientSeed}:${nonce}`;

    // Seeded Fisher-Yates shuffle — only shuffle until we have enough mines
    for (let i = gridSize - 1; i >= gridSize - mineCount; i--) {
      const j = this.getRandomIndex(combinedSeed, i, i + 1);
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    return tiles.slice(gridSize - mineCount);
  }

  private getRandomIndex(seed: string, position: number, max: number): number {
    const hmac = createHmac('sha256', seed).update(String(position)).digest('hex');
    // Take 4 bytes (32 bits) from the hash for sufficient entropy
    const value = parseInt(hmac.slice(0, 8), 16);
    return value % max;
  }
}
