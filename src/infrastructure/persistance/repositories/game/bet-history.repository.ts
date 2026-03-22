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
  minesBetHistory: {
    gridSize: number;
    minesCount: number;
    nonce: number;
    revealedTiles: number[];
    minePositions: number[];
    cashoutTile: number | null;
    minesHit: number | null;
  } | null;
  crashBetHistory: {
    roundId: string;
    cashoutAt: unknown;
    autoCashout: unknown;
    didCashout: boolean;
  } | null;
  coinflipGameHistory: {
    player1Username: string;
    player2Username: string;
    winnerSide: string;
    player1Side: string;
  } | null;
  seedRotationHistory: {
    serverSeedHash: string;
    clientSeed: string;
    serverSeed: string;
  } | null;
  diceBetHistory: {
    betAmount: number;
    chance: number;
    rollMode: string;
    rollResult: number;
    multiplier: number;
    payout: number;
    profit: number;
    clientSeed: string;
    serverSeedHash: string;
    nonce: number;
  } | null;
  caseOpenHistory: {
    caseId: string;
    wonCaseItemId: string;
    openBatchIndex: number;
    pricePaid: number;
    wonItemValue: number;
    nonce: number;
    serverSeedHash: string;
    clientSeed: string;
    normalizedRoll: number;
    wonItem: {
      variant: string[];
      pet: { id: number; name: string; image: string };
    };
  } | null;
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
    if (
      gameType &&
      ['MINES', 'CRASH', 'COINFLIP', 'DICE', 'CASE'].includes(gameType)
    ) {
      where.gameType = gameType as GameType;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.gameHistory.findMany({
        where,
        include: {
          minesBetHistory: true,
          crashBetHistory: true,
          coinflipGameHistory: true,
          diceBetHistory: true,
          caseOpenHistory: {
            include: {
              wonItem: {
                select: {
                  variant: true,
                  pet: {
                    select: {
                      id: true,
                      name: true,
                      image: true,
                    },
                  },
                },
              },
            },
          },
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
  const dbh = row.diceBetHistory;
  const srh = row.seedRotationHistory;
  const coh = row.caseOpenHistory;

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
  } else if (row.gameType === 'DICE' && dbh) {
    gameData = {
      bet_amount: Number(dbh.betAmount),
      chance: Number(dbh.chance),
      roll_mode: dbh.rollMode as 'OVER' | 'UNDER',
      roll_result: Number(dbh.rollResult),
      multiplier: Number(dbh.multiplier),
      seed_info: srh
        ? {
            server_seed_hash: srh.serverSeedHash,
            client_seed: srh.clientSeed,
            server_seed: srh.serverSeed,
            nonce: dbh.nonce,
          }
        : {
            nonce: dbh.nonce,
            server_seed_hash: dbh.serverSeedHash,
            client_seed: dbh.clientSeed,
            server_seed: null,
          },
    };
  } else if (row.gameType === 'CASE' && coh) {
    gameData = {
      case_id: coh.caseId,
      won_item: coh.wonItem,
      won_pet_value: Number(coh.wonItemValue),
      open_batch_index: coh.openBatchIndex,
      price_paid: Number(coh.pricePaid),
      seed_info: srh
        ? {
            server_seed_hash: srh.serverSeedHash,
            client_seed: srh.clientSeed,
            server_seed: srh.serverSeed,
            normalized_roll: coh.normalizedRoll,
            nonce: coh.nonce,
          }
        : {
            nonce: coh.nonce,
            server_seed_hash: coh.serverSeedHash,
            client_seed: coh.clientSeed,
            server_seed: null,
            normalized_roll: coh.normalizedRoll,
          },
    };
  }

  return {
    id: row.id,
    gameType: row.gameType,
    username: row.username,
    status: row.status,
    betAmount: row.caseOpenHistory ? Number(row.caseOpenHistory.pricePaid) : Number(row.betAmount),
    profit: row.profit !== null ? Number(row.profit) : null,
    multiplier: row.multiplier !== null ? Number(row.multiplier) : null,
    createdAt: row.createdAt,
    gameData,
  };
}
