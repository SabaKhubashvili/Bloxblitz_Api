import { Injectable, Logger } from '@nestjs/common';
import { GameStatus, GameType, Side } from '@prisma/client';
import { PlayerInterface } from 'src/types/jackpot.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { SaveCoinflipGameDto } from './dto/save-coinflip-game.dto';

@Injectable()
export class PrivateCoinflipHistoryService {
  private readonly logger = new Logger(PrivateCoinflipHistoryService.name);
  constructor(private readonly prisma: PrismaService) {}

  async saveGameInHistory({
    gameId,
    mainPlayer,
    player1,
    player2,
    winnerSide,
    betAmount,
    verificationData,
  }: SaveCoinflipGameDto): Promise<void> {
    try {
      await this.prisma.gameHistory.create({
        data: {
          username: mainPlayer,
          gameType: 'COINFLIP',
          betAmount: betAmount,
          status: GameStatus.FINISHED,
          profit: winnerSide === player1.side ? betAmount : -betAmount,
          multiplier: 1.98,
        },
      });
      
      const coinflip = await this.prisma.coinflipGameHistory.create({
        data: {
          gameId,
          winnerSide,
          player1Side: player1.side,
          player1Username: player1.username,
          player2Username: player2.username,
          updatedAt: new Date(),
        },
      });
      
      await this.prisma.onlinePlayerFairness.create({
        data: {
          gameId:coinflip.gameId,
          gameType: GameType.COINFLIP,
          serverSeedHash: verificationData.serverSeedHash,
          serverSeed: verificationData.serverSeed,
          eosBlockNumber: verificationData.eosBlockNumber,
          eosBlockId: verificationData.eosBlockId,
          nonce: verificationData.nonce,
          result: verificationData.result,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to save game ${gameId} in history: ${error.message}`,
      );
      throw error;
    }
  }
}
