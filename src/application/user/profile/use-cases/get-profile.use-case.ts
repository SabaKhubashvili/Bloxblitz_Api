import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface.js';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type.js';
import type { IProfileRepository } from '../../../../domain/user/ports/profile.repository.port.js';
import type { IProfileCachePort } from '../ports/profile-cache.port.js';
import type { GetProfileQuery } from '../dto/get-profile.query.js';
import type { ProfileOutputDto } from '../dto/profile.output-dto.js';
import {
  UserNotFoundError,
  type UserError,
} from '../../../../domain/user/errors/user.errors.js';
import { PROFILE_REPOSITORY, PROFILE_CACHE_PORT } from '../tokens/profile.tokens.js';
import { XpCalculationDomainService } from '../../../../domain/leveling/services/xp-calculation.domain-service.js';

const CACHE_TTL_SECONDS = 60;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class GetProfileUseCase
  implements IUseCase<GetProfileQuery, Result<ProfileOutputDto, UserError>>
{
  private readonly logger = new Logger(GetProfileUseCase.name);

  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profileRepo: IProfileRepository,
    @Inject(PROFILE_CACHE_PORT) private readonly profileCache: IProfileCachePort,
  ) {}

  async execute(
    query: GetProfileQuery,
  ): Promise<Result<ProfileOutputDto, UserError>> {
    try {
      const cached = await this.profileCache.get(query.username);
      if (cached !== null) {
        this.logger.debug(`[GetProfile] Cache hit for ${query.username}`);
        return Ok(cached);
      }
    } catch (cacheErr) {
      this.logger.warn(
        `[GetProfile] Cache read failed for ${query.username}, falling through to repo`,
        cacheErr,
      );
    }

    const record = await this.profileRepo.findByUsername(query.username);
    if (!record) {
      return Err(new UserNotFoundError(query.username));
    }

    const now = Date.now();
    const [wagerLast7Days, wagerLast30Days] = await Promise.all([
      this.profileRepo.sumWagerSince(query.username, new Date(now - SEVEN_DAYS_MS)),
      this.profileRepo.sumWagerSince(query.username, new Date(now - THIRTY_DAYS_MS)),
    ]);

    const { nextLevelXp, progress } = XpCalculationDomainService.xpProgressInLevel(
      record.totalXP,
      record.currentLevel,
    );

    const dto: ProfileOutputDto = {
      id: record.id,
      username: record.username,
      profile_picture: record.profile_picture,
      created_at: record.created_at.toISOString(),
      totalXp: record.totalXP,
      currentLevel: record.currentLevel,
      xpNeededForNextLevel: nextLevelXp,
      xpPercentage: Math.round(progress * 100),
      statistics: {
        totalDeposits: record.statistics?.totalDeposits.toString() ?? '0',
        totalWithdrawals: record.statistics?.totalWithdrawals.toString() ?? '0',
        totalProfit: record.statistics?.totalProfit.toString() ?? '0',
        totalLoss: record.statistics?.totalLoss.toString() ?? '0',
        totalWagered: record.statistics?.totalWagered.toString() ?? '0',
        wagerLast7Days,
        wagerLast30Days,
      },
      settings: {
        privateProfile: record.settings?.privateProfile ?? false,
      },
    };

    void this.profileCache
      .set(query.username, dto, CACHE_TTL_SECONDS)
      .catch((err) =>
        this.logger.warn(
          `[GetProfile] Cache write failed for ${query.username}`,
          err,
        ),
      );

    return Ok(dto);
  }
}
