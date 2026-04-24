import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IMinesHistoryRepository } from '../../../../domain/game/mines/ports/mines-history.repository.port';
import type { IMinesHistoryCachePort } from '../ports/mines-history-cache.port';
import type { GetMinesHistoryQuery } from '../dto/get-mines-history.query';
import type {
  MinesHistoryOutputDto,
  MinesHistoryItemOutputDto,
} from '../dto/mines-history.output-dto';
import type { MinesHistoryRecord } from '../../../../domain/game/mines/ports/mines-history.repository.port';
import {
  MinesHistoryFetchError,
  type MinesError,
} from '../../../../domain/game/mines/errors/mines.errors';
import {
  MINES_HISTORY_REPOSITORY,
  MINES_HISTORY_CACHE_PORT,
} from '../tokens/mines.tokens';

/** Cache TTL for paginated history pages (seconds). */
const HISTORY_PAGE_TTL = 120;

@Injectable()
export class GetUserMinesHistoryUseCase implements IUseCase<
  GetMinesHistoryQuery,
  Result<MinesHistoryOutputDto, MinesError>
> {
  private readonly logger = new Logger(GetUserMinesHistoryUseCase.name);

  constructor(
    @Inject(MINES_HISTORY_REPOSITORY)
    private readonly historyRepo: IMinesHistoryRepository,
    @Inject(MINES_HISTORY_CACHE_PORT)
    private readonly historyCache: IMinesHistoryCachePort,
  ) {}

  async execute(
    query: GetMinesHistoryQuery,
  ): Promise<Result<MinesHistoryOutputDto, MinesError>> {
    const { username, page, limit, order } = query;

    // ── Step 1: Cache-aside read ────────────────────────────────────────────
    try {
      const cached = await this.historyCache.getPage(
        username,
        page,
        limit,
        order,
      );
      if (cached !== null) {
        this.logger.debug(
          `[MinesHistory] Cache hit — user=${username} page=${page} order=${order}`,
        );
        return Ok(cached);
      }
    } catch (cacheErr) {
      this.logger.warn(
        `[MinesHistory] Cache read failed for ${username}, falling through to repo`,
        cacheErr,
      );
    }

    // ── Step 2: Authoritative read ──────────────────────────────────────────
    let page_data: Awaited<
      ReturnType<IMinesHistoryRepository['findPageByUsername']>
    >;

    try {
      page_data = await this.historyRepo.findPageByUsername(
        username,
        page,
        limit,
        order,
      );
    } catch (err) {
      this.logger.error(
        `[MinesHistory] Repository fetch failed for ${username}`,
        err,
      );
      return Err(new MinesHistoryFetchError());
    }

    // ── Step 3: Map to output DTO ───────────────────────────────────────────
    const dto: MinesHistoryOutputDto = {
      items: page_data.items.map(toItemOutputDto),
      total: page_data.total,
      page,
      limit,
      totalPages: Math.ceil(page_data.total / limit),
    };

    // ── Step 4: Populate cache (fire-and-forget) ────────────────────────────
    void this.historyCache
      .setPage(username, page, limit, order, dto, HISTORY_PAGE_TTL)
      .catch((err) =>
        this.logger.warn(
          `[MinesHistory] Cache write failed for ${username}`,
          err,
        ),
      );

    return Ok(dto);
  }
}

function toItemOutputDto(
  record: MinesHistoryRecord,
): MinesHistoryItemOutputDto {
  return {
    id: record.id,
    status: record.status,
    betAmount: record.betAmount,
    profit: record.profit,
    multiplier:
      record.multiplier !== null
        ? Math.round(record.multiplier * 10_000) / 10_000
        : null,
    // The entity stores gridSize as total cells; expose the side length for display.
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
