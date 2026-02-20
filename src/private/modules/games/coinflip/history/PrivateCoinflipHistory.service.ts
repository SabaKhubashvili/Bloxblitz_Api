import { Injectable, Logger } from '@nestjs/common';
import { GameType, Side } from '@prisma/client';
import { PlayerInterface } from 'src/types/jackpot.interface';
import { PrismaService } from 'src/prisma/prisma.service';
import { SaveCoinflipGameDto } from './dto/save-coinflip-game.dto';

@Injectable()
export class PrivateCoinflipHistoryService {
  private readonly logger = new Logger(PrivateCoinflipHistoryService.name);
  constructor(private readonly prisma: PrismaService) {}

  async saveGameInHistory({
    gameId,
    player1,
    player2,
    winnerSide,
    betAmount,
    verificationData,
  }: SaveCoinflipGameDto): Promise<void> {
    try {
      await this.prisma.gameHistory.create({
        data: {
          gameType: 'COINFLIP',
        },
      });
      
      const coinflip = await this.prisma.coinflipGameHistory.create({
        data: {
          gameId,
          betAmount,
          winnerSide,
          player1Side: player1.side,
          player1Username: player1.username,
          player2Username: player2.username,
          profit: betAmount * 0.98,
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
