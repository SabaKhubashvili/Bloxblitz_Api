import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CrashGameConfigDto,
  InsertBetHistoryDto,
  MinesGameConfigDto,
  MinesGameDataDto,
} from './dto/insert-bet-history.dto';
import { UpdateBetHistoryDto } from './dto/update-bet-history.dto';
import { GameType } from '@prisma/client';
import { CreateBetDto } from './types/private-bet-history.types';

@Injectable()
export class BetHistoryService {
  private readonly logger = new Logger(BetHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}
  private mapToCreateBetDto(dto: InsertBetHistoryDto): CreateBetDto {
    switch (dto.gameType) {
      case GameType.CRASH: {
        return {
          gameType: 'CRASH',
          username: dto.username,
          betAmount: dto.betAmount,
          profit: dto.profit,
          payout: dto.payout,
          gameConfig: dto.gameConfig as CrashGameConfigDto,
        };
      }

      case GameType.MINES: {
        return {
          gameType: 'MINES',
          username: dto.username,
          betAmount: dto.betAmount,
          profit: dto.profit,
          payout: dto.payout,
          gameData: dto.gameData as MinesGameDataDto,
          gameConfig: dto.gameConfig as MinesGameConfigDto,
        };
      }

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
        status: dto.status,
        profit: betData.profit,
        multiplier: dto.finalMultiplier,
      },
    });
    if (betData.gameType === 'CRASH') {
      const game = await this.prisma.crashBet.create({
        data: {
          gameId: gameHistory.id,
          roundId: betData.gameConfig.roundId,
          userUsername: betData.username,
          autoCashout: betData.gameConfig.autoCashoutAt,
        },
      });
      return { gameHistoryId: gameHistory.id, betId: game.id };
    } else if (betData.gameType === GameType.MINES) {
      this.logger.log(`Ddto ${JSON.stringify(dto)}`);

      const game = await this.prisma.minesBetHistory.create({
        data: {
          userUsername: betData.username,
          gameId: gameHistory.id,

          revealedTiles: betData.gameData.revealedTiles,
          minePositions: betData.gameData.minesPositions,

          gridSize: betData.gameConfig.gridSize,
          minesCount: betData.gameConfig.minesCount,
          nonce: betData.gameConfig.nonce || 0,
        },
      });
      return { gameHistoryId: gameHistory.id, betId: game.id };
    }
    return { gameHistoryId: gameHistory.id, betId: gameHistory.id || null };
  }
  update(betData: UpdateBetHistoryDto) {
    return this.prisma.gameHistory.updateMany({
      where: {
        id: betData.gameId,
      },
      data: {},
    });
  }
}
