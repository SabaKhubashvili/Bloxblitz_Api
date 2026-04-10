import { Injectable } from '@nestjs/common';
import {
  GameStatus,
  GameType,
  Prisma,
  type GameHistory,
  type TowersGameHistory,
  TowersGameStatus,
} from '@prisma/client';
import type { TowersGameEntity } from './towers-game.types';
import { PrismaService } from '../../prisma/prisma.service';
import { isTowersDifficulty } from '../../../../domain/game/towers/towers.config';
import type { TowersRowConfig } from '../../../../domain/game/towers/towers.config';
import type { TowersDifficulty } from '../../../../domain/game/towers/towers.enums';

export type TowersGameHistoryWithParent = TowersGameHistory & {
  parentHistory: GameHistory;
};

export type CreateTowersGameParams = {
  userUsername: string;
  betAmount: number;
  difficulty: TowersDifficulty;
  levels: number;
  rowConfigs: TowersRowConfig[];
  picks: (number | null)[];
  multiplierLadder: number[];
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
};

/** Pre-assigned PKs for idempotent async persistence (queue + worker). */
export type CreateTowersGameWithReservedIdsParams = CreateTowersGameParams & {
  gameHistoryId: string;
  towersRowId: string;
};

export type UpdateTowersGameParams = {
  status?: TowersGameStatus;
  currentRowIndex?: number;
  currentMultiplier?: number;
  picks?: (number | null)[];
};

function parseRowConfigs(raw: unknown): TowersRowConfig[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (r): r is TowersRowConfig =>
      r != null &&
      typeof r === 'object' &&
      'tiles' in r &&
      'gems' in r &&
      typeof (r as TowersRowConfig).tiles === 'number' &&
      typeof (r as TowersRowConfig).gems === 'number',
  );
}

function parsePicks(raw: unknown, levels: number): (number | null)[] {
  if (!Array.isArray(raw)) return Array.from({ length: levels }, () => null);
  const arr = raw.map((x) =>
    x === null || typeof x === 'number' ? x : null,
  ) as (number | null)[];
  while (arr.length < levels) arr.push(null);
  return arr.slice(0, levels);
}

function parseLadder(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => (typeof x === 'number' ? x : 0));
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

export function mapTowersPrismaToEntity(
  row: TowersGameHistoryWithParent,
): TowersGameEntity {
  const difficulty = row.difficulty;
  if (!isTowersDifficulty(difficulty)) {
    throw new Error('Invalid towers difficulty in persistence');
  }
  const levels = row.levels;
  const rowConfigs = parseRowConfigs(row.rowConfigs);
  return {
    id: row.id,
    gameHistoryId: row.gameId,
    userUsername: row.parentHistory.username,
    profilePicture: '',
    betAmount: Number(row.parentHistory.betAmount),
    difficulty,
    levels,
    rowConfigs,
    status: row.status,
    currentRowIndex: row.currentRowIndex,
    currentMultiplier: Number(row.currentMultiplier),
    picks: parsePicks(row.picks, levels),
    multiplierLadder: parseLadder(row.multiplierLadder),
    serverSeed: row.serverSeed,
    serverSeedHash: row.serverSeedHash,
    clientSeed: row.clientSeed,
    nonce: row.nonce,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class TowersGameRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveByUser(userUsername: string): Promise<TowersGameEntity | null> {
    const user = userUsername.toLowerCase();
    const row = await this.prisma.towersGameHistory.findFirst({
      where: {
        status: TowersGameStatus.ACTIVE,
        parentHistory: {
          username: user,
          gameType: GameType.TOWERS,
        },
      },
      include: { parentHistory: true },
      orderBy: { createdAt: 'desc' },
    });
    return row ? mapTowersPrismaToEntity(row) : null;
  }

  async create(params: CreateTowersGameParams): Promise<TowersGameEntity> {
    const row = await this.prisma.$transaction(async (tx) => {
      const parent = await tx.gameHistory.create({
        data: {
          gameType: GameType.TOWERS,
          username: params.userUsername.toLowerCase(),
          status: GameStatus.PLAYING,
          betAmount: params.betAmount,
        },
      });

      return tx.towersGameHistory.create({
        data: {
          gameId: parent.id,
          difficulty: params.difficulty,
          levels: params.levels,
          rowConfigs: params.rowConfigs as unknown as Prisma.InputJsonValue,
          picks: params.picks as unknown as Prisma.InputJsonValue,
          multiplierLadder:
            params.multiplierLadder as unknown as Prisma.InputJsonValue,
          serverSeed: params.serverSeed,
          serverSeedHash: params.serverSeedHash,
          clientSeed: params.clientSeed,
          nonce: params.nonce,
          status: TowersGameStatus.ACTIVE,
          currentRowIndex: 0,
          currentMultiplier: 1,
        },
        include: { parentHistory: true },
      });
    });

    return mapTowersPrismaToEntity(row);
  }

  async findByGameHistoryId(
    gameHistoryId: string,
  ): Promise<TowersGameEntity | null> {
    const row = await this.prisma.towersGameHistory.findUnique({
      where: { gameId: gameHistoryId },
      include: { parentHistory: true },
    });
    return row ? mapTowersPrismaToEntity(row) : null;
  }

  /**
   * Inserts parent `GameHistory` + `TowersGameHistory` with fixed ids (async worker).
   * On unique violation (replay), returns the existing row and `inserted: false`.
   */
  async createWithReservedIds(
    params: CreateTowersGameWithReservedIdsParams,
  ): Promise<{ entity: TowersGameEntity; inserted: boolean }> {
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        await tx.gameHistory.create({
          data: {
            id: params.gameHistoryId,
            gameType: GameType.TOWERS,
            username: params.userUsername.toLowerCase(),
            status: GameStatus.PLAYING,
            betAmount: params.betAmount,
          },
        });

        return tx.towersGameHistory.create({
          data: {
            id: params.towersRowId,
            gameId: params.gameHistoryId,
            difficulty: params.difficulty,
            levels: params.levels,
            rowConfigs: params.rowConfigs as unknown as Prisma.InputJsonValue,
            picks: params.picks as unknown as Prisma.InputJsonValue,
            multiplierLadder:
              params.multiplierLadder as unknown as Prisma.InputJsonValue,
            serverSeed: params.serverSeed,
            serverSeedHash: params.serverSeedHash,
            clientSeed: params.clientSeed,
            nonce: params.nonce,
            status: TowersGameStatus.ACTIVE,
            currentRowIndex: 0,
            currentMultiplier: 1,
          },
          include: { parentHistory: true },
        });
      });

      return { entity: mapTowersPrismaToEntity(row), inserted: true };
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        const existing = await this.findByGameHistoryId(params.gameHistoryId);
        if (existing) {
          return { entity: existing, inserted: false };
        }
      }
      throw err;
    }
  }

  async updateByIdForUser(
    id: string,
    userUsername: string,
    patch: UpdateTowersGameParams,
  ): Promise<TowersGameEntity> {
    const user = userUsername.toLowerCase();
    const existing = await this.prisma.towersGameHistory.findFirst({
      where: {
        id,
        parentHistory: { username: user },
      },
      include: { parentHistory: true },
    });
    if (!existing) {
      throw new Error('TOWERS_GAME_NOT_FOUND');
    }

    const row = await this.prisma.towersGameHistory.update({
      where: { id },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.currentRowIndex !== undefined
          ? { currentRowIndex: patch.currentRowIndex }
          : {}),
        ...(patch.currentMultiplier !== undefined
          ? { currentMultiplier: patch.currentMultiplier }
          : {}),
        ...(patch.picks !== undefined
          ? { picks: patch.picks as unknown as Prisma.InputJsonValue }
          : {}),
      },
      include: { parentHistory: true },
    });
    return mapTowersPrismaToEntity(row);
  }

  /**
   * Mid-round DB sync (active game still in progress). Used by async queue or sync fallback.
   */
  async persistMidGameState(
    towersRowId: string,
    patch: UpdateTowersGameParams,
  ): Promise<void> {
    await this.prisma.towersGameHistory.update({
      where: { id: towersRowId },
      data: {
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.currentRowIndex !== undefined
          ? { currentRowIndex: patch.currentRowIndex }
          : {}),
        ...(patch.currentMultiplier !== undefined
          ? { currentMultiplier: patch.currentMultiplier }
          : {}),
        ...(patch.picks !== undefined
          ? { picks: patch.picks as unknown as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  /**
   * Terminal round: Towers row + parent `GameHistory` in one transaction.
   */
  async persistTerminalState(params: {
    towersRowId: string;
    gameHistoryId: string;
    username: string;
    towersPatch: UpdateTowersGameParams;
    parentStatus: GameStatus;
    netProfit: number;
    finalMultiplier: number;
  }): Promise<void> {
    const user = params.username.toLowerCase();
    await this.prisma.$transaction(async (tx) => {
      await tx.towersGameHistory.update({
        where: {
          id: params.towersRowId,
          parentHistory: { username: user },
        },
        data: {
          ...(params.towersPatch.status !== undefined
            ? { status: params.towersPatch.status }
            : {}),
          ...(params.towersPatch.currentRowIndex !== undefined
            ? { currentRowIndex: params.towersPatch.currentRowIndex }
            : {}),
          ...(params.towersPatch.currentMultiplier !== undefined
            ? { currentMultiplier: params.towersPatch.currentMultiplier }
            : {}),
          ...(params.towersPatch.picks !== undefined
            ? { picks: params.towersPatch.picks as unknown as Prisma.InputJsonValue }
            : {}),
        },
      });

      await tx.gameHistory.update({
        where: { id: params.gameHistoryId },
        data: {
          status: params.parentStatus,
          profit: params.netProfit,
          multiplier: params.finalMultiplier,
        },
      });
    });
  }
}
