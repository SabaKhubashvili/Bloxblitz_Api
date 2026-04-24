import { Injectable, Logger } from '@nestjs/common';
import { IMinesGameRepository } from '../../../../domain/game/mines/ports/mines-game.repository.port';
import { MinesGame } from '../../../../domain/game/mines/entities/mines-game.entity';
import { GameStatus } from '../../../../domain/game/mines/value-objects/game-status.vo';
import { MineMask } from '../../../../domain/game/mines/value-objects/mine-mask.vo';
import { Money } from '../../../../domain/shared/value-objects/money.vo';
import { RedisService } from '../../../cache/redis.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisKeys } from '../../../cache/redis.keys';
import {
  GameStatus as PrismaGameStatus,
  GameType,
  Prisma,
} from '@prisma/client';
import { MINES_CONFIG_DEFAULTS } from '../../../../domain/game/mines/mines-config';
import { BumpGlobalUserStatisticsUseCase } from '../../user-statistics/bump-global-user-statistics.use-case';
import { BumpUserGameStatisticsUseCase } from '../../user-statistics/bump-user-game-statistics.use-case';

const activeGameKey = RedisKeys.mines.activeGame;
const gameKey = (gameId: string) => RedisKeys.mines.game(gameId);

interface RawStoredGame {
  id: string;
  username: string;
  betAmount: number;
  profilePicture: string;
  mineCount: number;
  minePositions: number[];
  gridSize: number;
  nonce: number;
  revealedTiles: number[];
  status: string;
  /** Percentage 0–100; absent on legacy keys — use defaults. */
  houseEdge?: number;
}

function resolveHouseEdgePercent(raw: RawStoredGame): number {
  const h = Number(raw.houseEdge);
  if (Number.isFinite(h) && h >= 0 && h <= 100) {
    return h;
  }
  return MINES_CONFIG_DEFAULTS.houseEdge;
}

function toDomainStatus(status: string): GameStatus {
  if (status === GameStatus.WON) return GameStatus.WON;
  if (status === GameStatus.LOST) return GameStatus.LOST;
  return GameStatus.ACTIVE;
}

function toPrismaStatus(status: GameStatus): PrismaGameStatus {
  if (status === GameStatus.WON) return PrismaGameStatus.CASHED_OUT;
  if (status === GameStatus.LOST) return PrismaGameStatus.LOST;
  return PrismaGameStatus.PLAYING;
}

function toDomain(raw: RawStoredGame): MinesGame {
  const gameResult = MinesGame.create({
    id: raw.id,
    username: raw.username,
    profilePicture: raw.profilePicture,
    betAmount: new Money(raw.betAmount),
    mineCount: raw.mineCount,
    mineMask: new MineMask(new Set(raw.minePositions)),
    nonce: raw.nonce,
    gridSize: raw.gridSize,
    houseEdge: resolveHouseEdgePercent(raw),
    revealedTiles: new Set(raw.revealedTiles),
    status: toDomainStatus(raw.status),
  });

  if (!gameResult.ok) {
    throw new Error(
      `Failed to reconstruct MinesGame ${raw.id}: ${gameResult.error.message}`,
    );
  }

  return gameResult.value;
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

function toRaw(game: MinesGame): RawStoredGame {
  return {
    id: game.id.value,
    username: game.username,
    betAmount: game.betAmount.amount,
    profilePicture: game.profilePicture,
    mineCount: game.mineCount,
    minePositions: game.getMinePositions(),
    gridSize: game.gridSize,
    nonce: game.nonce,
    revealedTiles: Array.from(game.revealedTiles),
    status: game.status,
    houseEdge: game.houseEdgePercent,
  };
}

@Injectable()
export class MinesGameRepository implements IMinesGameRepository {
  private readonly logger = new Logger(MinesGameRepository.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly bumpUserGame: BumpUserGameStatisticsUseCase,
    private readonly bumpGlobal: BumpGlobalUserStatisticsUseCase,
  ) {}

  async findActiveByusername(username: string): Promise<MinesGame | null> {
    const gameId = await this.redis.get<string>(activeGameKey(username));
    if (!gameId) return null;
    return this.findById(gameId);
  }

  async findById(id: string): Promise<MinesGame | null> {
    const raw = await this.redis.get<RawStoredGame>(gameKey(id));
    if (!raw) return null;
    return toDomain(raw);
  }

  /**
   * Writes active game to Redis only. Initial PostgreSQL row is persisted via BullMQ
   * (`save-mines-initial`) or sync fallback from the use case.
   */
  async save(game: MinesGame): Promise<void> {
    await this.writeGameCache(game);
  }

  async update(game: MinesGame): Promise<void> {
    await this.writeGameCache(game);
    void this.persistUpdateToDatabase(game);
  }

  private async writeGameCache(game: MinesGame): Promise<void> {
    const raw = toRaw(game);
    await this.redis.set(gameKey(game.id.value), raw, 86_400);
  }

  /**
   * Worker / sync fallback: insert `GameHistory` + `MinesBetHistory` for a new ACTIVE game.
   */
  async persistMinesInitialIdempotent(
    game: MinesGame,
  ): Promise<{ inserted: boolean }> {
    try {
      await this.persistNewActiveGameToDatabase(game);
      return { inserted: true };
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        const row = await this.prisma.minesBetHistory.findUnique({
          where: { gameId: game.id.value },
        });
        if (row) {
          return { inserted: false };
        }
      }
      throw err;
    }
  }

  private async persistNewActiveGameToDatabase(game: MinesGame): Promise<void> {
    const prismaStatus = toPrismaStatus(game.status);
    const isTerminal = game.status !== GameStatus.ACTIVE;
    const profit = isTerminal
      ? game.status === GameStatus.WON
        ? game.betAmount.multiply(game.calculateMultiplier() - 1).amount
        : -game.betAmount.amount
      : null;

    await this.prisma.gameHistory.create({
      data: {
        id: game.id.value,
        gameType: GameType.MINES,
        username: game.username,
        status: prismaStatus,
        betAmount: game.betAmount.amount,
        profit: profit,
        multiplier: null,
      },
    });

    await this.prisma.minesBetHistory.upsert({
      where: { gameId: game.id.value },
      create: {
        gameId: game.id.value,
        userUsername: game.username,
        gridSize: game.gridSize,
        minesCount: game.mineCount,
        nonce: game.nonce,
        revealedTiles: Array.from(game.revealedTiles),
        minePositions: game.getMinePositions(),
        status: prismaStatus,
      },
      update: {
        revealedTiles: Array.from(game.revealedTiles),
        status: prismaStatus,
        cashoutTile: isTerminal
          ? (Array.from(game.revealedTiles).at(-1) ?? null)
          : null,
        minesHit: game.status === GameStatus.LOST ? 1 : 0,
      },
    });

    if (isTerminal) {
      await this.prisma.gameHistory.update({
        where: { id: game.id.value },
        data: {
          status: prismaStatus,
          profit: profit,
          multiplier: game.calculateMultiplier(),
        },
      });
    }
  }

  async deleteActiveGame(username: string): Promise<void> {
    await this.redis.del(activeGameKey(username));
  }

  async deleteGame(id: string): Promise<void> {
    await this.redis.del(gameKey(id));
  }

  /**
   * Mid-game / terminal updates: upsert mines row and optionally parent `GameHistory`.
   * Fire-and-forget — errors are logged but not thrown (matches prior behavior).
   */
  private async persistUpdateToDatabase(game: MinesGame): Promise<void> {
    try {
      const prismaStatus = toPrismaStatus(game.status);
      const isTerminal = game.status !== GameStatus.ACTIVE;
      const profit = isTerminal
        ? game.status === GameStatus.WON
          ? game.betAmount.multiply(game.calculateMultiplier() - 1).amount
          : -game.betAmount.amount
        : null;

      await this.prisma.minesBetHistory.upsert({
        where: { gameId: game.id.value },
        create: {
          gameId: game.id.value,
          userUsername: game.username,
          gridSize: game.gridSize,
          minesCount: game.mineCount,
          nonce: game.nonce,
          revealedTiles: Array.from(game.revealedTiles),
          minePositions: game.getMinePositions(),
          status: prismaStatus,
        },
        update: {
          revealedTiles: Array.from(game.revealedTiles),
          status: prismaStatus,
          cashoutTile: isTerminal
            ? (Array.from(game.revealedTiles).at(-1) ?? null)
            : null,
          minesHit: game.status === GameStatus.LOST ? 1 : 0,
        },
      });

      if (isTerminal) {
        await this.prisma.gameHistory.update({
          where: { id: game.id.value },
          data: {
            status: prismaStatus,
            profit: profit,
            multiplier: game.calculateMultiplier(),
          },
        });
        const u = game.username.trim().toLowerCase();
        const stake = game.betAmount.amount;
        const netP =
          typeof profit === 'number' && Number.isFinite(profit) ? profit : 0;
        const won = game.status === GameStatus.WON;
        const playedAt = new Date();
        this.bumpUserGame.scheduleBump({
          username: u,
          gameType: GameType.MINES,
          stake,
          won,
          netProfit: netP,
          playedAt,
        });
        this.bumpGlobal.scheduleBump({
          username: u,
          gameType: GameType.MINES,
          stake,
          won,
          netProfit: netP,
          playedAt,
        });
      }
    } catch (err) {
      this.logger.error(`DB persistence failed for game ${game.id.value}`, err);
    }
  }
}
