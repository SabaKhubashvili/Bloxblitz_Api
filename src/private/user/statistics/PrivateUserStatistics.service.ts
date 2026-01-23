import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GetCoinflipWagerDto } from './dto/get-coinflip-wager.dto';

@Injectable()
export class PrivateUserStatisticsService {
  constructor(private readonly prismaService: PrismaService) { }

  getUserWager(username: string) {
    return this.prismaService.userStatistics.findUnique({
      where: { userUsername: username },
      select: { totalWagered: true },
    });
  }
  async incrementTotalWager(username: string, amount: number) {
    await this.prismaService.userStatistics.update({
      where: { userUsername: username },
      data: {
        totalWagered: {
          increment: amount,
        },
      },
    });
  }
  async updateStatistics(
    username: string,
    bet: number,
    isWinner: boolean,
    winAmount: number,
  ) {
    await this.prismaService.$executeRaw`
    UPDATE "UserStatistics"
    SET
      "totalWagered" = "totalWagered" + ${bet},
      "coinflipsWon" = "coinflipsWon" + CASE 
        WHEN ${isWinner} THEN 1 
        ELSE 0 
      END,
      "biggestWin" = CASE
        WHEN ${isWinner} THEN GREATEST("biggestWin", ${winAmount})
        ELSE "biggestWin"
      END
    WHERE "userUsername" = ${username};
  `;
  }
  async getUserCoinflipWager(data: GetCoinflipWagerDto) {
    const user = await this.prismaService.user.findUnique({
      where: {
        username: data.username,
      },
      select: {
        CoinflipGameHistory_CoinflipGameHistory_player1UsernameToUser: {
          select: {
            betAmount: true,
          },
          where: {
            createdAt: {
              gte: data.gte,
            },
          },
        },
        CoinflipGameHistory_CoinflipGameHistory_player2UsernameToUser: {
          select: {
            betAmount: true,
          },
          where: {
            createdAt: {
              gte: data.gte,
            },
          },
        },
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const totalWager =
      user.CoinflipGameHistory_CoinflipGameHistory_player2UsernameToUser.reduce(
        (a, b) => a + b.betAmount,
        0,
      ) +
      user.CoinflipGameHistory_CoinflipGameHistory_player1UsernameToUser.reduce(
        (a, b) => a + b.betAmount,
        0,
      );
    return totalWager;
  }
}
