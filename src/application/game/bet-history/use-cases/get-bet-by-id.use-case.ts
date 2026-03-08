import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IBetHistoryRepository } from '../../../../domain/game/bet-history/ports/bet-history.repository.port';
import type { BetHistoryItemOutputDto } from '../dto/bet-history.output-dto';
import {
  BetNotFoundError,
  BetHistoryFetchError,
  type BetHistoryError,
} from '../../../../domain/game/bet-history/errors/bet-history.errors';
import { BET_HISTORY_REPOSITORY } from '../tokens/bet-history.tokens';

export interface GetBetByIdInput {
  gameId: string;
  username: string;
}

@Injectable()
export class GetBetByIdUseCase
  implements IUseCase<GetBetByIdInput, Result<BetHistoryItemOutputDto, BetHistoryError>>
{
  private readonly logger = new Logger(GetBetByIdUseCase.name);

  constructor(
    @Inject(BET_HISTORY_REPOSITORY) private readonly betHistoryRepo: IBetHistoryRepository,
  ) {}

  async execute(
    input: GetBetByIdInput,
  ): Promise<Result<BetHistoryItemOutputDto, BetHistoryError>> {
    const { gameId, username } = input;

    try {
      const record = await this.betHistoryRepo.findByIdAndUsername(gameId, username);

      if (!record) {
        return Err(new BetNotFoundError(gameId));
      }

      const dto: BetHistoryItemOutputDto = {
        id: record.id,
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

      return Ok(dto);
    } catch (err) {
      this.logger.error(`[BetHistory] Fetch by ID failed for ${username}`, err);
      return Err(new BetHistoryFetchError());
    }
  }
}
