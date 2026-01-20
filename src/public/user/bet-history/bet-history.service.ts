import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { BetHistoryResponse } from "./result/get-bet-history.result";


@Injectable()
export class BetHistoryService {
  private readonly logger = new Logger(BetHistoryService.name);
  constructor(private readonly prismaService: PrismaService) {}

  async getBetHistory(
    username: string,
    page: number = 1,
    pageSize: number = 10
  ): Promise<BetHistoryResponse> {
    try {
      const skip = (page - 1) * pageSize;

      const [userGameData, total] = await this.prismaService.$transaction([
        this.prismaService.gameHistory.findMany({
          where: {
            userUsername: username
          },
          select: {
            gameType: true,
            betAmount: true,
            profit: true,
            serverSeedHash: true,
            clientSeed: true,
            nonce: true,
            startedAt: true,
            finalMultiplier:true,
            payout:true,
            outcome:true,
            seedRotationHistory: {
              select: {
                serverSeed: true
              }
            }
          },
          orderBy: { startedAt: 'desc' },
          skip,
          take: pageSize
        }),
        this.prismaService.gameHistory.count({
          where: {
            userUsername: username
          }
        })
      ]);

      return {
        data: userGameData,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      };
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          `Error fetching bet history for user ${username}: ${error.message}`
        );
      } else {
        this.logger.error(
          `Unknown error fetching bet history for user ${username}`
        );
      }
      throw new BadRequestException("Failed to fetch bet history");
    }
  }
}