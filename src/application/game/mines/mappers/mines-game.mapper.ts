import { MinesGame } from '../../../../domain/game/mines/entities/mines-game.entity';
import {
  MinesGameOutputDto,
  RevealTileOutputDto,
  CashoutOutputDto,
} from '../dto/mines-game.output-dto';

export class MinesGameMapper {
  static toOutputDto(game: MinesGame): MinesGameOutputDto {
    const isOver = !game.isActive();
    return {
      id: game.id.value,
      username: game.username,
      betAmount: game.betAmount.amount,
      mineCount: game.mineCount,
      gridSize: Math.sqrt(game.gridSize),
      status: game.status,
      revealedTiles: Array.from(game.revealedTiles).sort((a, b) => a - b),
      multiplier: game.calculateMultiplier(),
      nextRevealMultiplier: game.calculateNextRevealMultiplier(),
      nonce: game.nonce,
      minePositions: isOver ? game.getMinePositions() : undefined,
    };
  }

  static toRevealTileOutputDto(
    game: MinesGame,
    isMine: boolean,
  ): RevealTileOutputDto {
    return {
      ...this.toOutputDto(game),
      isMine,
    };
  }

  static toCashoutOutputDto(game: MinesGame, profit: number): CashoutOutputDto {
    return {
      ...this.toOutputDto(game),
      profit,
    };
  }
}
