import { Injectable, Logger } from '@nestjs/common';
import { IMinesGameRepository } from '../../../../domain/game/mines/ports/mines-game.repository.port.js';
import { MinesGame } from '../../../../domain/game/mines/entities/mines-game.entity.js';
import { GameStatus } from '../../../../domain/game/mines/value-objects/game-status.vo.js';
import { MineMask } from '../../../../domain/game/mines/value-objects/mine-mask.vo.js';
import { Money } from '../../../../domain/shared/value-objects/money.vo.js';
import { RedisService } from '../../../cache/redis.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { RedisKeys } from '../../../cache/redis.keys.js';
import { GameStatus as PrismaGameStatus, GameType } from '@prisma/client';

const activeGameKey = RedisKeys.mines.activeGame;
const gameKey = (gameId: string) => RedisKeys.mines.game(gameId);

interface RawStoredGame {
  id: string;
  username: string;
  betAmount: number;
  mineCount: number;
  minePositions: number[];
  gridSize: number;
  nonce: number;
  revealedTiles: number[];
  status: string;
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
    betAmount: new Money(raw.betAmount),
    mineCount: raw.mineCount,
    mineMask: new MineMask(new Set(raw.minePositions)),
    nonce: raw.nonce,
    gridSize: raw.gridSize,
    revealedTiles: new Set(raw.revealedTiles),
    status: toDomainStatus(raw.status),
  });

  if (!gameResult.ok) {
    throw new Error(`Failed to reconstruct MinesGame ${raw.id}: ${gameResult.error.message}`);
  }

  return gameResult.value;
}

function toRaw(game: MinesGame): RawStoredGame {
  return {
    id: game.id.value,
    username: game.username,
    betAmount: game.betAmount.amount,
    mineCount: game.mineCount,
    minePositions: game.getMinePositions(),
    gridSize: game.gridSize,
    nonce: game.nonce,
    revealedTiles: Array.from(game.revealedTiles),
    status: game.status,
  };
}

@Injectable()
export class MinesGameRepository implements IMinesGameRepository {
  private readonly logger = new Logger(MinesGameRepository.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
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

  async save(game: MinesGame): Promise<void> {
    const raw = toRaw(game);
    await this.redis.set(gameKey(game.id.value), raw, 86_400);
    void this.persistToDatabase(game, true);
  }

  async update(game: MinesGame): Promise<void> {
    const raw = toRaw(game);
    await this.redis.set(gameKey(game.id.value), raw, 86_400);
    void this.persistToDatabase(game, false);
  }

  async deleteActiveGame(username: string): Promise<void> {
    await this.redis.del(activeGameKey(username));
  }

  async deleteGame(id: string): Promise<void> {
    await this.redis.del(gameKey(id));
  }

  /**
   * Persists the game state to PostgreSQL asynchronously.
   * Uses upsert so that both initial creation and subsequent updates are handled.
   * Fire-and-forget on the hot path — errors are logged but not thrown.
   */
  private async persistToDatabase(game: MinesGame, isNew: boolean): Promise<void> {
    try {
      const prismaStatus = toPrismaStatus(game.status);
      const isTerminal = game.status !== GameStatus.ACTIVE;
      // For WON games: net gain = gross payout − bet = bet × (multiplier − 1).
      // For LOST games: player forfeits the full bet, so profit = −betAmount.
      const profit = isTerminal
        ? game.status === GameStatus.WON
          ? game.betAmount.multiply(game.calculateMultiplier() - 1).amount
          : -game.betAmount.amount
        : null;

      if (isNew) {
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
      }

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
          cashoutTile: isTerminal ? Array.from(game.revealedTiles).at(-1) ?? null : null,
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
    } catch (err) {
      this.logger.error(`DB persistence failed for game ${game.id.value}`, err);
    }
  }
}
