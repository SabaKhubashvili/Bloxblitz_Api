import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/provider/redis/redis.service';

@Injectable()
export class MinesHistoryService {
  private readonly logger = new Logger(MinesHistoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserGameHistory(username: string, limit: number) {
    try {
      const games = await this.getFromDatabase(username, limit);
      this.logger.log(
        `Fetched ${games.length} games from Database for user ${username}`,
      );
      return games;
    } catch (error) {
      this.logger.error(
        `Error fetching game history for user ${username}: ${error.message}`,
      );
      return [];
    }
  }

  private async getFromDatabase(username: string, limit: number) {
    const games = await this.prisma.gameHistory.findMany({
      where: {
        userUsername: username,
        gameType: 'MINES',
      },
      select: {
        betAmount: true,
        finalMultiplier: true,
        outcome: true,
        startedAt: true,
      },
      orderBy: {
        startedAt: 'desc',
      },
      take: limit,
    });
    return games;
  }
}
