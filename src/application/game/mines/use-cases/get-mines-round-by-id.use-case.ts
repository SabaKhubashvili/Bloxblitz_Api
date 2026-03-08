import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IMinesHistoryRepository, MinesHistoryRecord } from '../../../../domain/game/mines/ports/mines-history.repository.port';
import type { IMinesHistoryCachePort } from '../ports/mines-history-cache.port';
import type { GetMinesRoundByIdQuery } from '../dto/get-mines-round-by-id.query';
import type { MinesHistoryItemOutputDto } from '../dto/mines-history.output-dto';
import {
  MinesHistoryFetchError,
  MinesRoundNotFoundError,
  type MinesError,
} from '../../../../domain/game/mines/errors/mines.errors';
import {
  MINES_HISTORY_REPOSITORY,
  MINES_HISTORY_CACHE_PORT,
} from '../tokens/mines.tokens';

/** Cache TTL for individual round detail records (seconds). */
const ROUND_TTL = 300;

@Injectable()
export class GetMinesRoundByIdUseCase
  implements IUseCase<GetMinesRoundByIdQuery, Result<MinesHistoryItemOutputDto, MinesError>>
{
  private readonly logger = new Logger(GetMinesRoundByIdUseCase.name);

  constructor(
    @Inject(MINES_HISTORY_REPOSITORY) private readonly historyRepo: IMinesHistoryRepository,
    @Inject(MINES_HISTORY_CACHE_PORT) private readonly historyCache: IMinesHistoryCachePort,
  ) {}

  async execute(
    query: GetMinesRoundByIdQuery,
  ): Promise<Result<MinesHistoryItemOutputDto, MinesError>> {
    const { gameId, username } = query;

    // ── Step 1: Cache-aside read ────────────────────────────────────────────
    try {
      const cached = await this.historyCache.getRound(gameId);
      if (cached !== null) {
        this.logger.debug(`[MinesRound] Cache hit — gameId=${gameId}`);
        return Ok(cached);
      }
    } catch (cacheErr) {
      this.logger.warn(
        `[MinesRound] Cache read failed for ${gameId}, falling through to repo`,
        cacheErr,
      );
    }

    // ── Step 2: Authoritative read (ownership-checked) ──────────────────────
    let record: MinesHistoryRecord | null;

    try {
      record = await this.historyRepo.findByIdAndUsername(gameId, username);
    } catch (err) {
      this.logger.error(`[MinesRound] Repository fetch failed — gameId=${gameId}`, err);
      return Err(new MinesHistoryFetchError());
    }

    if (!record) return Err(new MinesRoundNotFoundError(gameId));

    // ── Step 3: Map to output DTO ───────────────────────────────────────────
    const dto = toItemOutputDto(record);

    // ── Step 4: Populate cache (fire-and-forget) ────────────────────────────
    void this.historyCache
      .setRound(gameId, dto, ROUND_TTL)
      .catch((err) =>
        this.logger.warn(`[MinesRound] Cache write failed — gameId=${gameId}`, err),
      );

    return Ok(dto);
  }
}

function toItemOutputDto(record: MinesHistoryRecord): MinesHistoryItemOutputDto {
  return {
    id: record.id,
    status: record.status,
    betAmount: record.betAmount,
    profit: record.profit,
    multiplier: record.multiplier !== null
      ? Math.round(record.multiplier * 10_000) / 10_000
      : null,
    gridSize: Math.sqrt(record.gridSize),
    minesCount: record.minesCount,
    nonce: record.nonce,
    revealedTiles: record.revealedTiles,
    minePositions: record.minePositions,
    cashoutTile: record.cashoutTile,
    minesHit: record.minesHit,
    createdAt: record.createdAt.toISOString(),
  };
}
