import { Injectable, Logger } from '@nestjs/common';
import { Side } from '@prisma/client';
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
      // await this.prisma.coinflipGameHistory.create({
      //   data: {
      //     gameId,
      //     player1Username: player1.username,
      //     player1Side: player1.side as Side,
      //     player2Username: player2.username,
      //     winnerSide: winnerSide,
      //     betAmount,
      //     player1Items: JSON.stringify(player1.items),
      //     player2Items: JSON.stringify(player2.items),
      //     CoinflipGameProvablyFairity: {
      //       create: {
      //         serverSeed: verificationData.serverSeed,
      //         serverSeedHash: verificationData.publicServerSeed,
      //         nonce: verificationData.nonce,
      //         result: verificationData.result,
      //       },
      //     },
      //     updatedAt: new Date(),
      //   },
      // });
    } catch (error) {
      this.logger.error(
        `Failed to save game ${gameId} in history: ${error.message}`,
      );
      throw error;
    }
  }
}
