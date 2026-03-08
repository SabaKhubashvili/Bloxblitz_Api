import { Injectable, Logger } from '@nestjs/common';
import { GameType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IMinesHistoryRepository,
  MinesHistoryPage,
  MinesHistoryRecord,
  MinesHistorySortOrder,
} from '../../../../domain/game/mines/ports/mines-history.repository.port';

@Injectable()
export class PrismaMinesHistoryRepository implements IMinesHistoryRepository {
  private readonly logger = new Logger(PrismaMinesHistoryRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findPageByUsername(
    username: string,
    page: number,
    limit: number,
    order: MinesHistorySortOrder,
  ): Promise<MinesHistoryPage> {
    const skip = (page - 1) * limit;

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.gameHistory.findMany({
        where: { username, gameType: GameType.MINES },
        include: { minesBetHistory: true },
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      this.prisma.gameHistory.count({
        where: { username, gameType: GameType.MINES },
      }),
    ]);

    return {
      items: rows.map(toDomain),
      total,
    };
  }

  async findByIdAndUsername(
    gameId: string,
    username: string,
  ): Promise<MinesHistoryRecord | null> {
    const row = await this.prisma.gameHistory.findFirst({
      where: { id: gameId, username, gameType: GameType.MINES },
      include: { minesBetHistory: true },
    });

    return row ? toDomain(row) : null;
  }
}

// ── Mapper ────────────────────────────────────────────────────────────────────

type GameHistoryWithMines = Awaited<
  ReturnType<PrismaService['gameHistory']['findMany']>
>[number] & { minesBetHistory: NonNullable<unknown> | null };

function toDomain(row: any): MinesHistoryRecord {
  const mines = row.minesBetHistory;

  return {
    id: row.id,
    username: row.username,
    status: row.status as string,
    betAmount: Number(row.betAmount),
    profit: row.profit !== null ? Number(row.profit) : null,
    multiplier: row.multiplier !== null ? Number(row.multiplier) : null,
    gridSize: mines?.gridSize ?? 0,
    minesCount: mines?.minesCount ?? 0,
    nonce: mines?.nonce ?? 0,
    revealedTiles: mines?.revealedTiles ?? [],
    minePositions: mines?.minePositions ?? [],
    cashoutTile: mines?.cashoutTile ?? null,
    minesHit: mines?.minesHit ?? null,
    createdAt: row.createdAt,
  };
}
