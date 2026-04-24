import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DailySpinState,
  type DailySpinStateProps,
} from '../../../../domain/daily-spin/entities/daily-spin-state.entity';
import type {
  IDailySpinRepository,
  DailySpinHistoryRecord,
  SaveSpinData,
} from '../../../../domain/daily-spin/ports/daily-spin.repository.port';

// ── Prisma payload type aliases ───────────────────────────────────────────────

type PrismaSpinState = Prisma.DailySpinStateGetPayload<object>;

// ── Mapping helpers ───────────────────────────────────────────────────────────

function toNumber(d: Prisma.Decimal | number): number {
  return typeof d === 'number' ? d : d.toNumber();
}

function toDomain(row: PrismaSpinState): DailySpinState {
  const props: DailySpinStateProps = {
    id: row.id,
    username: row.userUsername,
    lastSpinAt: row.lastSpinAt,
    nextSpinAt: row.nextSpinAt,
  };
  return DailySpinState.fromPersistence(props);
}

@Injectable()
export class PrismaDailySpinRepository implements IDailySpinRepository {
  private readonly logger = new Logger(PrismaDailySpinRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── IDailySpinRepository ──────────────────────────────────────────────────

  async findStateByUsername(username: string): Promise<DailySpinState | null> {
    const row = await this.prisma.dailySpinState.findUnique({
      where: { userUsername: username },
    });
    return row ? toDomain(row) : null;
  }

  /**
   * Atomically upserts the spin state and creates a history record inside a
   * single Prisma interactive transaction, preventing partial writes.
   */
  async saveSpinWithHistory(
    state: DailySpinState,
    data: SaveSpinData,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.dailySpinState.upsert({
        where: { userUsername: state.username },
        create: {
          id: state.id,
          userUsername: state.username,
          lastSpinAt: state.lastSpinAt!,
          nextSpinAt: state.nextSpinAt!,
        },
        update: {
          lastSpinAt: state.lastSpinAt!,
          nextSpinAt: state.nextSpinAt!,
        },
      });

      await tx.dailySpinHistory.create({
        data: {
          userUsername: state.username,
          prizeTier: data.prizeTier,
          prizeAmount: data.prizeAmount,
          prizeLabel: data.prizeLabel,
        },
      });
    });
  }

  async getSpinHistory(
    username: string,
    page: number,
    limit: number,
  ): Promise<DailySpinHistoryRecord[]> {
    const rows = await this.prisma.dailySpinHistory.findMany({
      where: { userUsername: username },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return rows.map((r) => ({
      id: r.id,
      userUsername: r.userUsername,
      prizeTier: r.prizeTier,
      prizeAmount: toNumber(r.prizeAmount),
      prizeLabel: r.prizeLabel,
      createdAt: r.createdAt,
    }));
  }

  async get30DayWager(username: string, since: Date): Promise<number> {
    const result = await this.prisma.gameHistory.aggregate({
      where: {
        username,
        createdAt: { gte: since },
        status: {
          notIn: ['CANCELLED', 'INITIALIZING'],
        },
      },
      _sum: { betAmount: true },
    });

    return toNumber(result._sum.betAmount ?? 0);
  }
}
