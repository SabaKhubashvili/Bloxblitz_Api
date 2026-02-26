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
      const isWinner =
        (mainPlayer === player1.username && winnerSide === player1.side) ||
        (mainPlayer === player2.username && winnerSide !== player1.side);

      await this.prisma.$transaction(async (prisma) => {
        const createdGameHistory = await prisma.gameHistory.create({
          data: {
            username: mainPlayer,
            gameType: 'COINFLIP',
            betAmount: betAmount,
            status: GameStatus.FINISHED,
            profit: isWinner ? betAmount : -betAmount,
            multiplier: 1.98,
          },
        });
        await prisma.onlinePlayerFairness.create({
          data: {
            gameId: createdGameHistory.id,
            gameType: GameType.COINFLIP,
            serverSeedHash: verificationData.serverSeedHash,
            serverSeed: verificationData.serverSeed,
            eosBlockNumber: verificationData.eosBlockNumber,
            eosBlockId: verificationData.eosBlockId,
            nonce: verificationData.nonce,
            result: verificationData.result,
          },
        });
        await prisma.coinflipGameHistory.create({
          data: {
            gameId: createdGameHistory.id,
            winnerSide,
            player1Side: player1.side,
            player1Username: player1.username,
            player2Username: player2.username,
            updatedAt: new Date(),
          },
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to save game ${gameId} in history: ${error.message}`,
      );
      throw error;
    }
  }
}
