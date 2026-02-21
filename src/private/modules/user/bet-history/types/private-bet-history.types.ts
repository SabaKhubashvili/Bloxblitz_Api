import { GameType } from '@prisma/client';

interface BaseBetDto<T extends GameType> {
  gameType: T;
  gameId: string;
  username: string;
  betAmount: number;
  profit: number;
}

interface CrashBetDto extends BaseBetDto<typeof GameType.CRASH> {
  payout?: number;
}

interface MinesBetDto extends BaseBetDto<typeof GameType.MINES> {
  gameData: {
    revealedTiles: number[];
    minesPositions: number[];
  };
  gameConfig: {
    gridSize: number;
    minesCount: number;
  };
}

export type CreateBetDto = CrashBetDto | MinesBetDto;