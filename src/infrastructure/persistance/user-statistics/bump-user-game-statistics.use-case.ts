import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { BumpUserGameStatisticsInput } from './bump-user-game-statistics.input';

function roundMoney(n: number): Prisma.Decimal {
  return new Prisma.Decimal(Math.round(n * 100) / 100);
}

type UserGameStatsDelegate = PrismaService['userGameStatistics'];

@Injectable()
export class BumpUserGameStatisticsUseCase {
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_BASE_DELAY_MS = 100;

  private readonly logger = new Logger(BumpUserGameStatisticsUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  scheduleBump(input: BumpUserGameStatisticsInput): void {
    setImmediate(() => {
      void this.runWithRetries(input, 0);
    });
  }

  async execute(input: BumpUserGameStatisticsInput): Promise<void> {
    await this.bump(this.prisma.userGameStatistics, input);
  }

  async bumpInTransaction(
    tx: { userGameStatistics: UserGameStatsDelegate },
    input: BumpUserGameStatisticsInput,
  ): Promise<void> {
    await this.bump(tx.userGameStatistics, input);
  }

  private async runWithRetries(
    input: BumpUserGameStatisticsInput,
    attempt: number,
  ): Promise<void> {
    try {
      await this.execute(input);
    } catch (err) {
      if (attempt + 1 < BumpUserGameStatisticsUseCase.MAX_ATTEMPTS) {
        const delay =
          BumpUserGameStatisticsUseCase.RETRY_BASE_DELAY_MS * (attempt + 1);
        setTimeout(() => {
          void this.runWithRetries(input, attempt + 1);
        }, delay);
        this.logger.warn(
          `[scheduleBump] attempt ${attempt + 1}/${BumpUserGameStatisticsUseCase.MAX_ATTEMPTS} failed user=${input.username} gameType=${input.gameType} retry in ${delay}ms`,
          err,
        );
        return;
      }
      this.logger.error(
        `[scheduleBump] giving up after ${attempt + 1} attempts user=${input.username.trim().toLowerCase()} gameType=${input.gameType}`,
        err,
      );
    }
  }

  private async bump(
    userGameStatistics: UserGameStatsDelegate,
    input: BumpUserGameStatisticsInput,
  ): Promise<void> {
    const user = input.username.trim().toLowerCase();
    const stakeD = roundMoney(input.stake);
    const profitD = roundMoney(input.netProfit);
    const payoutD = stakeD.add(profitD);

    await userGameStatistics.upsert({
      where: {
        userUsername_gameType: {
          userUsername: user,
          gameType: input.gameType,
        },
      },
      create: {
        userUsername: user,
        gameType: input.gameType,
        totalGames: 1,
        totalWagered: stakeD,
        totalPayout: payoutD,
        totalProfit: profitD,
        gamesWon: input.won ? 1 : 0,
        gamesLost: input.won ? 0 : 1,
        firstGameAt: input.playedAt,
        lastGameAt: input.playedAt,
      },
      update: {
        totalGames: { increment: 1 },
        totalWagered: { increment: stakeD },
        totalPayout: { increment: payoutD },
        totalProfit: { increment: profitD },
        gamesWon: { increment: input.won ? 1 : 0 },
        gamesLost: { increment: input.won ? 0 : 1 },
        lastGameAt: input.playedAt,
      },
    });
  }
}
