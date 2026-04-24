import { Injectable, Logger } from '@nestjs/common';
import { GameType, GameStatus, DiceRollMode, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IDiceHistoryRepository,
  DiceHistoryRecord,
  DiceHistoryPage,
  DiceHistorySortOrder,
  DiceBetToSave,
} from '../../../../domain/game/dice/ports/dice-history.repository.port';

@Injectable()
export class PrismaDiceHistoryRepository implements IDiceHistoryRepository {
  private readonly logger = new Logger(PrismaDiceHistoryRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findPageByUsername(
    username: string,
    page: number,
    limit: number,
    order: DiceHistorySortOrder,
  ): Promise<DiceHistoryPage> {
    const skip = (page - 1) * limit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.diceBet.findMany({
        where: { userUsername: username },
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      this.prisma.diceBet.count({
        where: { userUsername: username },
      }),
    ]);

    return {
      items: rows.map(toRecord),
      total,
    };
  }

  async saveBet(bet: DiceBetToSave): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const gameHistory = await tx.gameHistory.create({
        data: {
          id: bet.id,
          gameType: GameType.DICE,
          username: bet.username,
          status: GameStatus.FINISHED,
          betAmount: new Prisma.Decimal(bet.betAmount),
          profit: new Prisma.Decimal(bet.profit),
          multiplier: new Prisma.Decimal(bet.multiplier),
        },
      });

      await tx.diceBet.create({
        data: {
          userUsername: bet.username,
          gameHistoryId: gameHistory.id,
          betAmount: new Prisma.Decimal(bet.betAmount),
          chance: new Prisma.Decimal(bet.chance),
          rollMode: bet.rollMode as DiceRollMode,
          rollResult: new Prisma.Decimal(bet.rollResult),
          multiplier: new Prisma.Decimal(bet.multiplier),
          payout: new Prisma.Decimal(bet.payout),
          profit: new Prisma.Decimal(bet.profit),
          clientSeed: bet.clientSeed,
          serverSeedHash: bet.serverSeedHash,
          nonce: bet.nonce,
        },
      });
    });
  }

  async saveBetIdempotent(bet: DiceBetToSave): Promise<{ inserted: boolean }> {
    try {
      await this.saveBet(bet);
      return { inserted: true };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const parent = await this.prisma.gameHistory.findUnique({
          where: { id: bet.id },
        });
        if (parent) {
          return { inserted: false };
        }
      }
      throw e;
    }
  }
}

function toNumber(d: { toNumber: () => number } | number | unknown): number {
  if (typeof d === 'number') return d;
  if (d && typeof (d as { toNumber: () => number }).toNumber === 'function') {
    return (d as { toNumber: () => number }).toNumber();
  }
  return Number(d) || 0;
}

function toRecord(row: {
  id: string;
  userUsername: string;
  betAmount: unknown;
  chance: unknown;
  rollMode: string;
  rollResult: unknown;
  multiplier: unknown;
  payout: unknown;
  profit: unknown;
  clientSeed: string;
  serverSeedHash: string;
  nonce: number;
  createdAt: Date;
}): DiceHistoryRecord {
  return {
    id: row.id,
    username: row.userUsername,
    betAmount: toNumber(row.betAmount),
    chance: toNumber(row.chance),
    rollMode: row.rollMode as 'OVER' | 'UNDER',
    rollResult: toNumber(row.rollResult),
    multiplier: toNumber(row.multiplier),
    payout: toNumber(row.payout),
    profit: toNumber(row.profit),
    clientSeed: row.clientSeed,
    serverSeedHash: row.serverSeedHash,
    nonce: row.nonce,
    createdAt: row.createdAt,
  };
}
