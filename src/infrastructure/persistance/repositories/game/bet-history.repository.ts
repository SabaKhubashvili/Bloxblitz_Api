import { Injectable, Logger } from '@nestjs/common';
import { GameType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IBetHistoryRepository,
  BetHistoryRecord,
  BetHistoryPage,
  BetHistorySortOrder,
} from '../../../../domain/game/bet-history/ports/bet-history.repository.port';

type GameHistoryRow = Awaited<
  ReturnType<PrismaService['gameHistory']['findMany']>
>[number] & {
  minesBetHistory: { gridSize: number; minesCount: number; nonce: number; revealedTiles: number[]; minePositions: number[]; cashoutTile: number | null; minesHit: number | null } | null;
  crashBetHistory: { roundId: string; cashoutAt: unknown; autoCashout: unknown; didCashout: boolean } | null;
  coinflipGameHistory: { player1Username: string; player2Username: string; winnerSide: string; player1Side: string } | null;
  seedRotationHistory: { serverSeedHash: string; clientSeed: string; serverSeed: string } | null;
};

@Injectable()
export class PrismaBetHistoryRepository implements IBetHistoryRepository {
  private readonly logger = new Logger(PrismaBetHistoryRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findPageByUsername(
    username: string,
    page: number,
    limit: number,
    order: BetHistorySortOrder,
    gameType?: string,
  ): Promise<BetHistoryPage> {
    const skip = (page - 1) * limit;

    const where: { username: string; gameType?: GameType } = { username };
    if (gameType && ['MINES', 'CRASH', 'COINFLIP'].includes(gameType)) {
      where.gameType = gameType as GameType;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.gameHistory.findMany({
        where,
        include: {
          minesBetHistory: true,
          crashBetHistory: true,
          coinflipGameHistory: true,
          seedRotationHistory: true,
        },
        orderBy: { createdAt: order },
        skip,
        take: limit,
      }),
      this.prisma.gameHistory.count({ where }),
    ]);

    return {
      items: (rows as GameHistoryRow[]).map(toBetHistoryRecord),
      total,
    };
  }

  async findByIdAndUsername(
    gameId: string,
    username: string,
  ): Promise<BetHistoryRecord | null> {
    const row = await this.prisma.gameHistory.findFirst({
      where: { id: gameId, username },
      include: {
        minesBetHistory: true,
        crashBetHistory: true,
        coinflipGameHistory: true,
        seedRotationHistory: true,
      },
    });

    return row ? toBetHistoryRecord(row as GameHistoryRow) : null;
  }
}

function toBetHistoryRecord(row: GameHistoryRow): BetHistoryRecord {
  const mb = row.minesBetHistory;
  const cb = row.crashBetHistory;
  const cfg = row.coinflipGameHistory;
  const srh = row.seedRotationHistory;

  let gameData: Record<string, unknown> | null = null;

  if (row.gameType === 'MINES' && mb) {
    gameData = {
      grid_size: mb.gridSize,
      mines_count: mb.minesCount,
      revealed_tiles: mb.revealedTiles,
      mine_positions: mb.minePositions,
      cashout_tile: mb.cashoutTile,
      mines_hit: mb.minesHit,
      seed_info: srh
        ? {
            server_seed_hash: srh.serverSeedHash,
            client_seed: srh.clientSeed,
            server_seed: srh.serverSeed,
            nonce: mb.nonce,
          }
        : { nonce: mb.nonce },
    };
  } else if (row.gameType === 'CRASH' && cb) {
    gameData = {
      round_id: cb.roundId,
      cashout_at: cb.cashoutAt,
      auto_cashout: cb.autoCashout,
      did_cashout: cb.didCashout,
    };
  } else if (row.gameType === 'COINFLIP' && cfg) {
    gameData = {
      player1_username: cfg.player1Username,
      player2_username: cfg.player2Username,
      winner_side: cfg.winnerSide,
      player1_side: cfg.player1Side,
    };
  }

  return {
    id: row.id,
    gameType: row.gameType,
    username: row.username,
    status: row.status,
    betAmount: Number(row.betAmount),
    profit: row.profit !== null ? Number(row.profit) : null,
    multiplier: row.multiplier !== null ? Number(row.multiplier) : null,
    createdAt: row.createdAt,
    gameData,
  };
}
