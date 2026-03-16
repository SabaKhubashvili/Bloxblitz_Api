import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { MineMask } from '../value-objects/mine-mask.vo';

/**
 * Provably Fair Mines generation
 *
 * Algorithm:
 * - HMAC-SHA256(serverSeed, clientSeed:nonce:cursor)
 * - Extract 52 bits of entropy from hash
 * - Use rejection sampling to remove modulo bias
 * - Deterministic partial Fisher-Yates shuffle
 *
 * This allows any player to verify the mine layout after the server seed is revealed.
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
   * Reproduces mine layout after server seed reveal.
   */
  verifyGame(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    gridSize: number,
    mineCount: number,
  ): number[] {
    return this.generateMinePositions(
      serverSeed,
      clientSeed,
      nonce,
      gridSize,
      mineCount,
    );
  }

  private generateMinePositions(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    gridSize: number,
    mineCount: number,
  ): number[] {

    const tiles = Array.from({ length: gridSize }, (_, i) => i);
    let cursor = 0;

    /**
     * Partial Fisher-Yates shuffle
     * Only shuffle last N tiles to place mines efficiently
     */
    for (let i = gridSize - 1; i >= gridSize - mineCount; i--) {

      const j = this.getRandomIndex(
        serverSeed,
        clientSeed,
        nonce,
        cursor,
        i + 1,
      );

      cursor++;

      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    return tiles.slice(gridSize - mineCount);
  }

  /**
   * Generates unbiased random index using rejection sampling
   */
  private getRandomIndex(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    cursor: number,
    max: number,
  ): number {

    let round = 0;

    while (true) {

      const message = `${clientSeed}:${nonce}:${cursor}:${round}`;

      const hash = createHmac('sha256', serverSeed)
        .update(message)
        .digest('hex');

      /**
       * Use 52 bits of entropy (casino standard)
       */
      const value = parseInt(hash.slice(0, 13), 16);

      const maxRange = Math.pow(2, 52);
      const limit = maxRange - (maxRange % max);

      if (value < limit) {
        return value % max;
      }

      round++;
    }
  }
}