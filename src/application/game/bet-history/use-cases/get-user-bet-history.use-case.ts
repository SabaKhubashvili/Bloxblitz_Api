import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IBetHistoryRepository } from '../../../../domain/game/bet-history/ports/bet-history.repository.port';
import type { GetBetHistoryQuery } from '../dto/get-bet-history.query';
import type {
  BetHistoryOutputDto,
  BetHistoryItemOutputDto,
} from '../dto/bet-history.output-dto';
import type { BetHistoryRecord } from '../../../../domain/game/bet-history/ports/bet-history.repository.port';
import {
  BetHistoryFetchError,
  type BetHistoryError,
} from '../../../../domain/game/bet-history/errors/bet-history.errors';
import { BET_HISTORY_REPOSITORY } from '../tokens/bet-history.tokens';

@Injectable()
export class GetUserBetHistoryUseCase implements IUseCase<
  GetBetHistoryQuery,
  Result<BetHistoryOutputDto, BetHistoryError>
> {
  private readonly logger = new Logger(GetUserBetHistoryUseCase.name);

  constructor(
    @Inject(BET_HISTORY_REPOSITORY)
    private readonly betHistoryRepo: IBetHistoryRepository,
  ) {}

  async execute(
    query: GetBetHistoryQuery,
  ): Promise<Result<BetHistoryOutputDto, BetHistoryError>> {
    const { username, page, limit, order, gameType } = query;

    try {
      const pageData = await this.betHistoryRepo.findPageByUsername(
        username,
        page,
        limit,
        order,
        gameType,
      );

      const dto: BetHistoryOutputDto = {
        items: pageData.items.map(toItemOutputDto),
        total: pageData.total,
        page,
        limit,
        totalPages: Math.ceil(pageData.total / limit),
      };

      return Ok(dto);
    } catch (err) {
      this.logger.error(
        `[BetHistory] Repository fetch failed for ${username}`,
        err,
      );
      return Err(new BetHistoryFetchError());
    }
  }
}

function toItemOutputDto(record: BetHistoryRecord): BetHistoryItemOutputDto {
  return {
    id: record.id,
    username: record.username,
    gameType: record.gameType,
    status: record.status,
    betAmount: record.betAmount,
    profit: record.profit,
    multiplier:
      record.multiplier !== null
        ? Math.round(record.multiplier * 10_000) / 10_000
        : null,
    createdAt: record.createdAt.toISOString(),
    gameData: record.gameData,
  };
}
