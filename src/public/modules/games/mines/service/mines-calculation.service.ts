import { Injectable, BadRequestException } from '@nestjs/common';
import { createHmac, createHash } from 'crypto';

@Injectable()
export class MinesCalculationService {
  calculateMultiplier(mines: number, gridSize: number, tilesRevealed: number): number {
    if (tilesRevealed === 0) return 1;

    const safeTiles = gridSize - mines;
    if (safeTiles <= 0 || tilesRevealed > safeTiles) {
      throw new Error('Invalid game state for multiplier calculation');
    }

    let multiplier = 1;
    for (let i = 0; i < tilesRevealed; i++) {
      const remainingSafeTiles = safeTiles - i;
      const remainingTotalTiles = gridSize - i;
      multiplier *= remainingTotalTiles / remainingSafeTiles;
    }

    multiplier *= 0.99;
    multiplier = Math.min(multiplier, 1000);

    return parseFloat(multiplier.toFixed(2));
  }

  generateMineMask(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    size: 25 | 16,
    mines: number,
  ): number {
    if (mines >= size) {
      throw new BadRequestException(`Cannot place ${mines} mines on a ${size}-cell grid`);
    }

    const positions = new Set<number>();
    let cursor = 0;

    const combinedSeed = `${clientSeed}:${nonce}`;
    let currentHash = createHmac('sha256', serverSeed).update(combinedSeed).digest('hex');

    while (positions.size < mines) {
      for (let i = 0; i < currentHash.length - 3 && positions.size < mines; i += 4) {
        const chunk = currentHash.substring(i, i + 4);
        const value = parseInt(chunk, 16);
        const maxValue = Math.floor(65536 / size) * size;

        if (value < maxValue) {
          positions.add(value % size);
        }
      }

      if (positions.size < mines) {
        currentHash = createHash('sha256')
          .update(currentHash + cursor.toString())
          .digest('hex');
        cursor++;
      }

      if (cursor > 1000) {
        throw new Error('Failed to generate mine positions - exceeded max iterations');
      }
    }

    let mask = 0;
    positions.forEach((pos) => {
      mask |= 1 << pos;
    });

    return mask;
  }

  maskToTileArray(mask: number): number[] {
    const tiles: number[] = [];
    let pos = 0;
    let tempMask = mask;

    while (tempMask > 0) {
      if (tempMask & 1) tiles.push(pos);
      tempMask >>= 1;
      pos++;
    }

    return tiles;
  }

  countBits(n: number): number {
    let count = 0;
    while (n) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  }
}
