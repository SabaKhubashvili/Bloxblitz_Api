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
    const games = await this.prisma.minesBetHistory.findMany({
      where: {
        userUsername: username,
      },
      select: {
        status: true,
        createdAt: true,
        parentHistory:{
          select:{
            betAmount:true,
            multiplier:true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
    const data = games.map((game) => ({
      status: game.status,
      createdAt: game.createdAt,
      betAmount: game?.parentHistory?.betAmount || 0,
      multiplier: game?.parentHistory?.multiplier || 0,
    }));
    return data;
  }
}
