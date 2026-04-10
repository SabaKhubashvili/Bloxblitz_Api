import { Injectable, Logger } from '@nestjs/common';
import { GameType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IBetHistoryRepository,
  BetHistoryRecord,
  BetHistoryPage,
  BetHistorySortOrder,
} from '../../../../domain/game/bet-history/ports/bet-history.repository.port';
import type { TowersRowConfig } from '../../../../domain/game/towers/towers.config';
import { towersDeriveAllGemIndicesByRow } from '../../../../domain/game/towers/towers-fairness.service';

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
    fairness: {
      serverSeed: string;
      serverSeedHash: string;
      eosBlockNumber: number;
      eosBlockId: string;
      nonce: number;
      result: string;
    } | null;
  } | null;
  towersGameHistory: {
    id: string;
    gameId: string;
    difficulty: string;
    levels: number;
    rowConfigs: unknown;
    status: string;
    currentRowIndex: number;
    currentMultiplier: unknown;
    picks: unknown;
    multiplierLadder: unknown;
    serverSeed: string;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  rouletteRound: {
    gameIndex: number;
    serverSeed: string;
    eosBlockId: string;
    outcomeHash: string;
    outcome: string;
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
      [
        'MINES',
        'CRASH',
        'COINFLIP',
        'DICE',
        'CASE',
        'ROULETTE',
        'TOWERS',
      ].includes(gameType)
    ) {
      where.gameType = gameType as GameType;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.gameHistory.findMany({
        where,
        include: {
          minesBetHistory: true,
          crashBetHistory: true,
          coinflipGameHistory: { include: { fairness: true } },
          towersGameHistory: true,
          diceBetHistory: true,
          rouletteRound: {
            select: {
              gameIndex: true,
              serverSeed: true,
              eosBlockId: true,
              outcomeHash: true,
              outcome: true,
            },
          },
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
        coinflipGameHistory: { include: { fairness: true } },
        towersGameHistory: true,
        diceBetHistory: true,
        rouletteRound: {
          select: {
            gameIndex: true,
            serverSeed: true,
            eosBlockId: true,
            outcomeHash: true,
            outcome: true,
          },
        },
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
    });

    return row ? toBetHistoryRecord(row as GameHistoryRow) : null;
  }
}

function parseTowersRowConfigsJson(raw: unknown): TowersRowConfig[] {
  if (!Array.isArray(raw)) return [];
  const rows: TowersRowConfig[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const tiles = Number(o.tiles);
    const gems = Number(o.gems);
    if (
      !Number.isFinite(tiles) ||
      tiles < 1 ||
      !Number.isFinite(gems) ||
      gems < 1 ||
      gems > tiles
    ) {
      continue;
    }
    rows.push({ tiles, gems });
  }
  return rows;
}

function toBetHistoryRecord(row: GameHistoryRow): BetHistoryRecord {
  const mb = row.minesBetHistory;
  const cb = row.crashBetHistory;
  const cfg = row.coinflipGameHistory;
  const dbh = row.diceBetHistory;
  const srh = row.seedRotationHistory;
  const coh = row.caseOpenHistory;
  const tg = row.towersGameHistory;
  const rr = row.rouletteRound;

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
    const fair = cfg.fairness;
    gameData = {
      player1_username: cfg.player1Username,
      player2_username: cfg.player2Username,
      winner_side: cfg.winnerSide,
      player1_side: cfg.player1Side,
      ...(fair
        ? {
            fairness: {
              server_seed: fair.serverSeed,
              server_seed_hash: fair.serverSeedHash,
              eos_block_number: fair.eosBlockNumber,
              eos_block_id: fair.eosBlockId,
              nonce: fair.nonce,
              result: fair.result,
            },
          }
        : {}),
    };
  } else if (row.gameType === 'TOWERS' && tg) {
    const towerRows = parseTowersRowConfigsJson(tg.rowConfigs);
    let gem_tile_indices: number[][] = [];
    if (
      towerRows.length > 0 &&
      tg.serverSeed &&
      tg.clientSeed &&
      Number.isFinite(tg.nonce)
    ) {
      try {
        gem_tile_indices = towersDeriveAllGemIndicesByRow({
          serverSeed: tg.serverSeed,
          clientSeed: tg.clientSeed,
          nonce: tg.nonce,
          rows: towerRows,
        });
      } catch {
        gem_tile_indices = [];
      }
    }
    /** Only expose decrypted server seed after seed rotation (linked history); never the raw game row seed. */
    const seed_info = srh
      ? {
          server_seed_hash: srh.serverSeedHash,
          client_seed: srh.clientSeed,
          server_seed: srh.serverSeed,
          nonce: tg.nonce,
        }
      : {
          server_seed_hash: tg.serverSeedHash,
          client_seed: tg.clientSeed,
          server_seed: null as string | null,
          nonce: tg.nonce,
        };
    gameData = {
      towers_record_id: tg.id,
      game_id: tg.gameId,
      difficulty: tg.difficulty,
      levels: tg.levels,
      row_configs: tg.rowConfigs,
      towers_status: tg.status,
      current_row_index: tg.currentRowIndex,
      current_multiplier: Number(tg.currentMultiplier),
      picks: tg.picks,
      multiplier_ladder: tg.multiplierLadder,
      gem_tile_indices,
      seed_info,
      towers_created_at: tg.createdAt.toISOString(),
      towers_updated_at: tg.updatedAt.toISOString(),
    };
  } else if (row.gameType === 'ROULETTE') {
    gameData = {
      seed_info: rr
        ? {
            game_index: rr.gameIndex,
            server_seed: rr.serverSeed,
            eos_block_id: rr.eosBlockId,
            outcome_hash: rr.outcomeHash,
            outcome: rr.outcome,
          }
        : null,
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
