import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PrivateUserStatisticsService {
  constructor(private readonly prismaService: PrismaService) {}

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

}
