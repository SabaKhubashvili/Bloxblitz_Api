import type { GameType } from '@prisma/client';

interface BaseBetDto {
  gameType: GameType;
  username: string;
  betAmount: number;
  profit?: number;
  payout?: number;
}

/**
 * MINES
 */
export interface MinesBetDto extends BaseBetDto {
  gameType: 'MINES';

  gameData: {
    revealedTiles: number[];
    minesPositions: number[];
  };

  gameConfig: {
    gridSize: number;
    minesCount: number;
    nonce: number;
  };
}

/**
 * CRASH
 */
export interface CrashBetDto extends BaseBetDto {
  gameType: 'CRASH';


  gameConfig: {
    maxMultiplier: number;
    houseEdge: number;
    autoCashoutAt?: number

  roundId:string
  };
}

export type CreateBetDto =
  | MinesBetDto
  | CrashBetDto;