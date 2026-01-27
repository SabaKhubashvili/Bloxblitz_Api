import { Injectable, BadRequestException } from '@nestjs/common';
import { MinesGame } from '../types/mines.types';

@Injectable()
export class MinesValidationService {
  validateGameParams(
    rawBetAmount: string | number,
    mines: number,
    size: number,
  ): void {
    // Convert to string and trim
    const betAmountStr = String(rawBetAmount).trim();

    // Match numbers with up to 2 decimals: optional digits, optional decimal + 1-2 digits
    const validNumberRegex = /^\d+(\.\d{1,2})?$/;

    if (!validNumberRegex.test(betAmountStr)) {
      throw new BadRequestException(
        'Bet amount must be a number with at most 2 decimal places',
      );
    }

    const betAmount = Number(betAmountStr);
    if (betAmount <= 0) {
      throw new BadRequestException('Bet amount must be positive');
    }

    if (mines <= 0 || mines >= size) {
      throw new BadRequestException(`Mines must be between 1 and ${size - 1}`);
    }
  }

  validateGameAccess(
    game: MinesGame | null,
    username: string,
  ): asserts game is MinesGame {
    if (!game) {
      throw new BadRequestException('Game not found');
    }
    if (game.creatorUsername !== username) {
      throw new BadRequestException('Not your game');
    }
    if (!game.active) {
      throw new BadRequestException('Game already ended');
    }
  }

  validateTileReveal(game: MinesGame, tile: number): void {
    if (tile < 0 || tile >= game.grid) {
      throw new BadRequestException(
        `Invalid tile index. Must be 0-${game.grid - 1}`,
      );
    }

    const bit = 1 << tile;
    if (game.revealedMask & bit) {
      throw new BadRequestException('Tile already revealed');
    }
  }

  validateCashout(game: MinesGame): void {
    if (this.countBits(game.revealedMask) === 0) {
      console.log('Failed to cashout - no tiles revealed:');

      console.log(game)
      throw new BadRequestException(
        'Must reveal at least one tile before cashing out',
      );
    }
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
