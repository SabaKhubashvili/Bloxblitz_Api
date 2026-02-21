import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InsertBetHistoryDto } from './dto/insert-bet-history.dto';
import { UpdateBetHistoryDto } from './dto/update-bet-history.dto';
import { GameType } from '@prisma/client';
import { CreateBetDto } from './types/private-bet-history.types';

@Injectable()
export class BetHistoryService {
  constructor(private readonly prisma: PrismaService) {}
  private mapToCreateBetDto(dto: InsertBetHistoryDto): CreateBetDto {
    switch (dto.gameType) {
      case GameType.CRASH:
        return {
          gameType: GameType.CRASH,
          gameId: dto.gameId,
          username: dto.username,
          betAmount: dto.betAmount,
          profit: dto.profit,
          payout: dto.payout,
        };

      case GameType.MINES:
        return {
          gameType: GameType.MINES,
          gameId: dto.gameId,
          username: dto.username,
          betAmount: dto.betAmount,
          profit: dto.profit,
          gameData: dto.gameData,
          gameConfig: dto.gameConfig,
        };

      default:
        throw new Error('Unsupported game type');
    }
  }
  async add(dto: InsertBetHistoryDto) {
    const betData = this.mapToCreateBetDto(dto);
    const gameHistory = await this.prisma.gameHistory.create({
      data: {
        gameType: betData.gameType,
        username: betData.username,
        betAmount: betData.betAmount,
        status: "PLAYING",
        profit: betData.profit,
      },
    });
    if (betData.gameType === 'CRASH') {
      return this.prisma.crashBet.create({
        data: {
          roundId: betData.gameId,
          gameId: gameHistory.id,
          userUsername: betData.username,
          // fairness:{
          //   create:{
          //     serverSeedHash: betData.serverSeedHash,
          //     serverSeed: betData.serverSeedHash,
          //     nonce: betData.nonce,
          //   }
          // }
        },
      });
    } else if (betData.gameType === 'MINES') {
      return this.prisma.minesBetHistory.create({
        data: {
          userUsername: betData.username,
          gameId: gameHistory.id,
          
          revealedTiles: betData.gameData.revealedTiles,
          minePositions: betData.gameData.minesPositions,
          minesHit: 0,
          


          gridSize: betData.gameConfig.gridSize,
          minesCount: betData.gameConfig.minesCount,
        },
      });
    }
    return gameHistory;
  }
  update(betData: UpdateBetHistoryDto) {
    return this.prisma.gameHistory.updateMany({
      where: {
        id: betData.gameId,
      },
      data: {
        
      },
    });
  }
}
