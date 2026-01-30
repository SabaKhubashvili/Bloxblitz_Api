import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GameOutcome } from '@prisma/client';
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
    SELECT 
      gh.id,
      gh."gameType",
      gh."betAmount",
      gh."userUsername",
      gh.profit,
      gh."serverSeedHash",
      gh."clientSeed",
      gh.nonce,
      gh."startedAt",
      gh."finalMultiplier",
      gh.payout,
      gh.outcome,
      gh."gameConfig",
      CASE 
        WHEN gh.outcome = 'PLAYING' THEN NULL 
        ELSE gh."gameData" 
      END as "gameData",
      CASE 
        WHEN gh.outcome = 'PLAYING' THEN NULL 
        WHEN srh."serverSeed" IS NULL THEN NULL
        ELSE jsonb_build_object('serverSeed', srh."serverSeed")
      END as "seedRotationHistory"
    FROM "GameHistory" gh
    LEFT JOIN "SeedRotationHistory" srh 
      ON gh."seedRotationHistoryId" = srh.id
    WHERE gh."userUsername" = ${username}
    ORDER BY gh."startedAt" DESC
    LIMIT ${pageSize}
    OFFSET ${skip}
  `,
  this.prismaService.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "GameHistory"
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
