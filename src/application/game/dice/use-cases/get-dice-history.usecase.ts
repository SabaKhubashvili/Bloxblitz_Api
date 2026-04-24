import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IDiceHistoryRepository } from '../../../../domain/game/dice/ports/dice-history.repository.port';
import type { IDiceHistoryCachePort } from '../ports/dice-history-cache.port';
import type { GetDiceHistoryQuery } from '../dto/dice-history.query';
import type {
  DiceHistoryOutputDto,
  DiceHistoryItemOutputDto,
} from '../dto/dice-history.output-dto';
import type { DiceHistoryRecord } from '../../../../domain/game/dice/ports/dice-history.repository.port';
import {
  DiceHistoryFetchError,
  type DiceError,
} from '../../../../domain/game/dice/errors/dice.errors';
import {
  DICE_HISTORY_CACHE_PORT,
  DICE_HISTORY_REPOSITORY,
} from '../tokens/dice.tokens';

/** Cache TTL for paginated dice history (seconds). */
const HISTORY_PAGE_TTL = 120;

@Injectable()
export class GetDiceHistoryUseCase implements IUseCase<
  GetDiceHistoryQuery,
  Result<DiceHistoryOutputDto, DiceError>
> {
  private readonly logger = new Logger(GetDiceHistoryUseCase.name);

  constructor(
    @Inject(DICE_HISTORY_REPOSITORY)
    private readonly historyRepo: IDiceHistoryRepository,
    @Inject(DICE_HISTORY_CACHE_PORT)
    private readonly historyCache: IDiceHistoryCachePort,
  ) {}

  async execute(
    query: GetDiceHistoryQuery,
  ): Promise<Result<DiceHistoryOutputDto, DiceError>> {
    const { username, page, limit, order } = query;

    try {
      const cached = await this.historyCache.getPage(
        username,
        page,
        limit,
        order,
      );
      if (cached !== null) {
        this.logger.debug(
          `[DiceHistory] Cache hit — user=${username} page=${page} order=${order}`,
        );
        return Ok(cached);
      }
    } catch (cacheErr) {
      this.logger.warn(
        `[DiceHistory] Cache read failed for ${username}, falling through to repo`,
        cacheErr,
      );
    }

    let pageData: Awaited<
      ReturnType<IDiceHistoryRepository['findPageByUsername']>
    >;

    try {
      pageData = await this.historyRepo.findPageByUsername(
        username,
        page,
        limit,
        order,
      );
    } catch (err) {
      this.logger.error(
        `[DiceHistory] Repository fetch failed for ${username}`,
        err,
      );
      return Err(new DiceHistoryFetchError());
    }

    const dto: DiceHistoryOutputDto = {
      items: pageData.items.map(toItemOutputDto),
      total: pageData.total,
      page,
      limit,
      totalPages: Math.ceil(pageData.total / limit),
    };

    void this.historyCache
      .setPage(username, page, limit, order, dto, HISTORY_PAGE_TTL)
      .catch((err) =>
        this.logger.warn(
          `[DiceHistory] Cache write failed for ${username}`,
          err,
        ),
      );

    return Ok(dto);
  }
}

function toItemOutputDto(record: DiceHistoryRecord): DiceHistoryItemOutputDto {
  return {
    id: record.id,
    rollResult: record.rollResult,
    betAmount: record.betAmount,
    payout: record.payout,
    multiplier: Math.round(record.multiplier * 10_000) / 10_000,
    profit: record.profit,
    chance: record.chance,
    rollMode: record.rollMode,
    clientSeed: record.clientSeed,
    serverSeedHash: record.serverSeedHash,
    nonce: record.nonce,
    createdAt: record.createdAt.toISOString(),
  };
}
