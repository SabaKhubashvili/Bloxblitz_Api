import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok } from '../../../../domain/shared/types/result.type';
import type { IDailySpinRepository } from '../../../../domain/daily-spin/ports/daily-spin.repository.port';
import { DAILY_SPIN_REPOSITORY } from '../tokens/daily-spin.tokens';
import type { GetDailySpinHistoryQuery } from '../dto/get-daily-spin-history.query';
import type { DailySpinHistoryOutputDto } from '../dto/daily-spin.output-dto';

@Injectable()
export class GetDailySpinHistoryUseCase
  implements IUseCase<GetDailySpinHistoryQuery, Result<DailySpinHistoryOutputDto, never>>
{
  constructor(
    @Inject(DAILY_SPIN_REPOSITORY) private readonly repo: IDailySpinRepository,
  ) {}

  async execute(
    query: GetDailySpinHistoryQuery,
  ): Promise<Result<DailySpinHistoryOutputDto, never>> {
    const safeLimit = Math.min(Math.max(query.limit, 1), 50);
    const safePage  = Math.max(query.page, 1);

    const records = await this.repo.getSpinHistory(query.username, safePage, safeLimit);

    return Ok({
      items: records.map((r) => ({
        id:          r.id,
        prizeLabel:  r.prizeLabel,
        prizeAmount: r.prizeAmount,
        prizeTier:   r.prizeTier,
        spunAt:      r.createdAt,
      })),
      page:  safePage,
      limit: safeLimit,
    });
  }
}
