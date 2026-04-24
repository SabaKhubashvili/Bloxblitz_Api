import { Injectable, Logger } from '@nestjs/common';
import { GameType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { BumpGlobalUserStatisticsInput } from './bump-global-user-statistics.input';

function roundMoney(n: number): Prisma.Decimal {
  return new Prisma.Decimal(Math.round(n * 100) / 100);
}

@Injectable()
export class BumpGlobalUserStatisticsUseCase {
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_BASE_DELAY_MS = 100;

  private readonly logger = new Logger(BumpGlobalUserStatisticsUseCase.name);

  constructor(private readonly prisma: PrismaService) {}

  scheduleBump(input: BumpGlobalUserStatisticsInput): void {
    setImmediate(() => {
      void this.runWithRetries(input, 0);
    });
  }

  async execute(input: BumpGlobalUserStatisticsInput): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await this.bumpWithClient(tx, input);
    });
  }

  async bumpInTransaction(
    tx: Prisma.TransactionClient,
    input: BumpGlobalUserStatisticsInput,
  ): Promise<void> {
    await this.bumpWithClient(tx, input);
  }

  private async runWithRetries(
    input: BumpGlobalUserStatisticsInput,
    attempt: number,
  ): Promise<void> {
    try {
      await this.execute(input);
    } catch (err) {
      if (attempt + 1 < BumpGlobalUserStatisticsUseCase.MAX_ATTEMPTS) {
        const delay =
          BumpGlobalUserStatisticsUseCase.RETRY_BASE_DELAY_MS * (attempt + 1);
        setTimeout(() => {
          void this.runWithRetries(input, attempt + 1);
        }, delay);
        this.logger.warn(
          `[scheduleBump] global attempt ${attempt + 1} failed user=${input.username} gameType=${input.gameType} retry in ${delay}ms`,
          err,
        );
        return;
      }
      this.logger.error(
        `[scheduleBump] global giving up after ${attempt + 1} attempts user=${input.username} gameType=${input.gameType}`,
        err,
      );
    }
  }

  private gameSpecificDeltas(
    input: BumpGlobalUserStatisticsInput,
  ): Prisma.UserStatisticsUpdateInput {
    if (input.gameType === GameType.COINFLIP) {
      return input.won
        ? { coinflipsWon: { increment: 1 } }
        : { coinflipsLost: { increment: 1 } };
    }
    if (input.gameType === GameType.CRASH) {
      return { crashGamesPlayed: { increment: 1 } };
    }
    if (input.gameType === GameType.MINES) {
      return { minesGamesPlayed: { increment: 1 } };
    }
    return {};
  }

  private async bumpWithClient(
    tx: Prisma.TransactionClient,
    input: BumpGlobalUserStatisticsInput,
  ): Promise<void> {
    const user = input.username.trim().toLowerCase();
    const stakeD = roundMoney(input.stake);
    const netD = roundMoney(input.netProfit);
    const gameDeltas = this.gameSpecificDeltas(input);
    const baseUpdate: Prisma.UserStatisticsUpdateInput = {
      totalWagered: { increment: stakeD },
      totalGamesPlayed: { increment: 1 },
      ...(input.won
        ? { totalGamesWon: { increment: 1 } }
        : { totalGamesLost: { increment: 1 } }),
      ...gameDeltas,
    };

    if (netD.gt(0)) {
      Object.assign(baseUpdate, {
        totalProfit: { increment: netD },
        netProfit: { increment: netD },
      });
    } else if (netD.lt(0)) {
      Object.assign(baseUpdate, {
        totalLoss: { increment: netD.abs() },
        netProfit: { increment: netD },
      });
    } else {
      Object.assign(baseUpdate, { netProfit: { increment: netD } });
    }

    const existing = await tx.userStatistics.findUnique({
      where: { userUsername: user },
    });
    if (!existing) {
      const create: Prisma.UserStatisticsCreateInput = {
        user: { connect: { username: user } },
        totalWagered: stakeD,
        totalGamesPlayed: 1,
        totalGamesWon: input.won ? 1 : 0,
        totalGamesLost: input.won ? 0 : 1,
        totalProfit: netD.gt(0) ? netD : new Prisma.Decimal(0),
        totalLoss: netD.lt(0) ? netD.abs() : new Prisma.Decimal(0),
        netProfit: netD,
        ...this.createGameSpecificOnCreate(input),
        ...(this.initialBiggestWinOnCreate(input, netD) ?? {}),
        ...this.initialMultiplierOnCreate(input),
        ...this.initialHighCrashOnCreate(input),
      };
      await tx.userStatistics.create({ data: create });
      return;
    }

    const currentBiggest = existing.biggestWin;
    const currentBiggestMult = existing.biggestMultiplier;
    const currentHighCrash = existing.highestCrashPoint;
    const winFields: Prisma.UserStatisticsUpdateInput = {};
    if (netD.gt(0) && currentBiggest.lt(netD)) {
      winFields.biggestWin = netD;
      winFields.biggestWinGame = String(input.gameType);
      winFields.biggestWinDate = input.playedAt;
    }
    if (input.gameType === GameType.CRASH) {
      if (input.multiplier != null && Number.isFinite(input.multiplier)) {
        const m = new Prisma.Decimal(String(input.multiplier));
        if (currentBiggestMult.lt(m)) {
          winFields.biggestMultiplier = m;
        }
      }
      if (input.crashPoint != null) {
        const c = new Prisma.Decimal(String(input.crashPoint));
        if (currentHighCrash.lt(c)) {
          winFields.highestCrashPoint = c;
        }
      }
    } else if (
      input.gameType === GameType.TOWERS &&
      input.multiplier != null &&
      Number.isFinite(input.multiplier)
    ) {
      const m = new Prisma.Decimal(String(input.multiplier));
      if (currentBiggestMult.lt(m)) {
        winFields.biggestMultiplier = m;
      }
    }

    await tx.userStatistics.update({
      where: { userUsername: user },
      data: {
        ...baseUpdate,
        ...winFields,
      },
    });
  }

  private createGameSpecificOnCreate(
    input: BumpGlobalUserStatisticsInput,
  ): Partial<Prisma.UserStatisticsCreateInput> {
    if (input.gameType === GameType.COINFLIP) {
      return {
        coinflipsWon: input.won ? 1 : 0,
        coinflipsLost: input.won ? 0 : 1,
      };
    }
    if (input.gameType === GameType.CRASH) {
      return { crashGamesPlayed: 1 };
    }
    if (input.gameType === GameType.MINES) {
      return { minesGamesPlayed: 1 };
    }
    return {};
  }

  private initialBiggestWinOnCreate(
    input: BumpGlobalUserStatisticsInput,
    netD: Prisma.Decimal,
  ): {
    biggestWin: Prisma.Decimal;
    biggestWinGame: string;
    biggestWinDate: Date;
  } | null {
    if (!netD.gt(0)) {
      return null;
    }
    return {
      biggestWin: netD,
      biggestWinGame: String(input.gameType),
      biggestWinDate: input.playedAt,
    };
  }

  private initialMultiplierOnCreate(
    input: BumpGlobalUserStatisticsInput,
  ): Pick<Prisma.UserStatisticsCreateInput, 'biggestMultiplier'> {
    if (
      (input.gameType === GameType.CRASH ||
        input.gameType === GameType.TOWERS) &&
      input.multiplier != null &&
      Number.isFinite(input.multiplier) &&
      input.multiplier > 0
    ) {
      return {
        biggestMultiplier: new Prisma.Decimal(String(input.multiplier)),
      };
    }
    return {};
  }

  private initialHighCrashOnCreate(
    input: BumpGlobalUserStatisticsInput,
  ): Pick<Prisma.UserStatisticsCreateInput, 'highestCrashPoint'> {
    if (input.gameType === GameType.CRASH && input.crashPoint != null) {
      return {
        highestCrashPoint: new Prisma.Decimal(String(input.crashPoint)),
      };
    }
    return {};
  }
}
