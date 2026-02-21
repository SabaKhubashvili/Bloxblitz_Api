import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { BetHistoryResponse } from './result/get-bet-history.result';

@Injectable()
export class BetHistoryService {
  private readonly logger = new Logger(BetHistoryService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async getBetHistory(
    username: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<BetHistoryResponse> {
    try {
      return await this.getGamesFromDatabase(username, page, pageSize);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error fetching bet history for user ${username}: ${error.message}`,
        );
      } else {
        this.logger.error(
          `Unknown error fetching bet history for user ${username}`,
        );
      }
      throw new BadRequestException('Failed to fetch bet history');
    }
  }

  private async getGamesFromDatabase(
    username: string,
    page: number,
    pageSize: number,
  ): Promise<BetHistoryResponse> {
    const skip = (page - 1) * pageSize;
    const [userGameData, totalResult] = await this.prismaService.$transaction([
      this.prismaService.$queryRaw`
    SELECT  * from unified_game_feed
    WHERE "userUsername" = ${username}
    ORDER BY "createdAtp" DESC
    LIMIT ${pageSize}
    OFFSET ${skip}
  `,
      this.prismaService.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "unified_game_feed"
    WHERE "userUsername" = ${username}
  `,
    ]);
    const total = (totalResult as any)[0]?.count || 0;

    return {
      data: userGameData as any,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
