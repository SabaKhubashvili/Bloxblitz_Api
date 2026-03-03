import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface.js';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type.js';
import { RakebackType } from '../../../../domain/rakeback/enums/rakeback-type.enum.js';
import type { ITimeProvider } from '../../../../domain/rakeback/interfaces/time-provider.interface.js';
import type { IRakebackRepository } from '../../../../domain/rakeback/ports/rakeback.repository.port.js';
import type { IRakebackCachePort } from '../ports/rakeback-cache.port.js';
import type { RakebackDataOutputDto } from '../dto/rakeback-data.output-dto.js';
import { RakebackNotFoundError, type RakebackError } from '../../../../domain/rakeback/errors/rakeback.errors.js';
import { RAKEBACK_REPOSITORY, RAKEBACK_CACHE_PORT, TIME_PROVIDER } from '../tokens/rakeback.tokens.js';

@Injectable()
export class GetRakebackDataUseCase
  implements IUseCase<{ username: string }, Result<RakebackDataOutputDto, RakebackError>>
{
  constructor(
    @Inject(RAKEBACK_REPOSITORY) private readonly repo: IRakebackRepository,
    @Inject(RAKEBACK_CACHE_PORT) private readonly cache: IRakebackCachePort,
    @Inject(TIME_PROVIDER)       private readonly time: ITimeProvider,
  ) {}

  async execute(input: { username: string }): Promise<Result<RakebackDataOutputDto, RakebackError>> {
    const cached = await this.cache.get(input.username);
    if (cached) return Ok(cached);

    const rakeback = await this.repo.findByUsername(input.username);
    if (!rakeback) return Err(new RakebackNotFoundError());

    const now = this.time.now();
    const dto: RakebackDataOutputDto = {
      daily:   rakeback.getInfo(RakebackType.DAILY, now),
      weekly:  rakeback.getInfo(RakebackType.WEEKLY, now),
      monthly: rakeback.getInfo(RakebackType.MONTHLY, now),
    };

    await this.cache.set(input.username, dto, 30);
    return Ok(dto);
  }
}
