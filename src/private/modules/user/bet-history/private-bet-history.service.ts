import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InsertBetHistoryDto } from './dto/insert-bet-history.dto';
import { UpdateBetHistoryDto } from './dto/update-bet-history.dto';

@Injectable()
export class BetHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  add(betData: InsertBetHistoryDto) {
    return this.prisma.gameHistory.create({
      data: {
        userUsername: betData.username,
        gameId: betData.gameId,
        betAmount: betData.betAmount,
        outcome: betData.outcome,
        startedAt: betData.startedAt,

        gameType: betData.gameType,
        serverSeedHash: betData.serverSeedHash,
        clientSeed: betData.clientSeed,
        nonce: betData.nonce,
        profit: betData.profit,

        gameConfig: betData.gameConfig,
        gameData: betData.gameData,
        finalMultiplier: betData.finalMultiplier,
        payout: betData.payout,
      },
    });
  }
  update(betData: UpdateBetHistoryDto) {
    return this.prisma.gameHistory.updateMany({
      where: {
        ...(betData.username !== undefined && {
          userUsername: betData.username,
        }),
        gameId: betData.gameId,
      },
      data: {
        ...(betData.username !== undefined && {
          userUsername: betData.username,
        }),
        ...(betData.gameType !== undefined && {
          gameType: betData.gameType,
        }),
        ...(betData.betAmount !== undefined && {
          betAmount: betData.betAmount,
        }),
        ...(betData.outcome !== undefined && {
          outcome: betData.outcome,
        }),
        ...(betData.finalMultiplier !== undefined && {
          finalMultiplier: betData.finalMultiplier,
        }),
        ...(betData.payout !== undefined && {
          payout: betData.payout,
        }),
        ...(betData.profit !== undefined && {
          profit: betData.profit,
        }),
        ...(betData.serverSeedHash !== undefined && {
          serverSeedHash: betData.serverSeedHash,
        }),
        ...(betData.clientSeed !== undefined && {
          clientSeed: betData.clientSeed,
        }),
        ...(betData.nonce !== undefined && {
          nonce: betData.nonce,
        }),
      },
    });
  }
}
