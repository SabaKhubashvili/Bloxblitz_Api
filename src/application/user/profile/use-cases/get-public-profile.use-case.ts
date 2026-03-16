import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IProfileRepository } from '../../../../domain/user/ports/profile.repository.port';
import type { IProfileCachePort } from '../ports/profile-cache.port';

import {
  UserNotFoundError,
  type UserError,
} from '../../../../domain/user/errors/user.errors';
import { PROFILE_REPOSITORY, PROFILE_CACHE_PORT } from '../tokens/profile.tokens';
import { XpCalculationDomainService } from '../../../../domain/leveling/services/xp-calculation.domain-service';
import { GetProfileQuery } from '../dto/get-profile.query';
import { PrivateProfileOutputDto, PublicProfileOutputDto } from '../dto/profile.output-dto';
import { UserRoles } from '@prisma/client';

const CACHE_TTL_SECONDS = 60;

@Injectable()
export class GetPublicProfileUseCase
  implements IUseCase<GetProfileQuery, Result<PublicProfileOutputDto | PrivateProfileOutputDto, UserError>>
{
  private readonly logger = new Logger(GetPublicProfileUseCase.name);

  constructor(
    @Inject(PROFILE_REPOSITORY) private readonly profileRepo: IProfileRepository,
    @Inject(PROFILE_CACHE_PORT) private readonly profileCache: IProfileCachePort,

  ) {}

  async execute(
    query: GetProfileQuery,
  ): Promise<Result<PublicProfileOutputDto | PrivateProfileOutputDto, UserError>> {
    const onlineStatus = await this.profileCache.getOnlineStatus(query.username);
    if (onlineStatus !== null) {
      this.logger.debug(`[GetPublicProfile] Online status for ${query.username}: ${onlineStatus}`);
    }
    try {
      const cached = await this.profileCache.getPublic(query.username);
      if (cached !== null) {
        this.logger.debug(`[GetPublicProfile] Cache hit for ${query.username}`);
        return Ok({...cached, isOnline: onlineStatus ?? false});
      }
    } catch (cacheErr) {
      this.logger.warn(
        `[GetPublicProfile] Cache read failed for ${query.username}, falling through to repo`,
        cacheErr,
      );
    }

    const [record, leaderboardRank] = await Promise.all([
      this.profileRepo.findByUsername(query.username),
      this.profileRepo.getLeaderboardRank(query.username),
    ]);

    if (!record) {
      return Err(new UserNotFoundError(query.username));
    }

    const { nextLevelXp, progress, currentLevelXp } = XpCalculationDomainService.xpProgressInLevel(
      record.totalXP,
      record.currentLevel,
    );

    const dto: Omit<PublicProfileOutputDto,'isOnline'> | PrivateProfileOutputDto = record.settings?.privateProfile ? {
      privateProfile: true,
      username: record.username,
      profile_picture: record.profile_picture,
      currentLevel: record.currentLevel,
      totalXP: record.totalXP,
      progressPercentage: progress,
      xpNeededForNextLevel: nextLevelXp,
    } : {
      id: record.id,
      username: record.username,
      role: UserRoles.MEMBER,
      profile_picture: record.profile_picture,
      created_at: record.created_at.toISOString(),
      statistics: {
        totalWagered: record.statistics?.totalWagered.toNumber() || 0,
        totalGamesWon: record.statistics?.totalGamesWon || 0,
        biggestWin: record.statistics?.biggestWin.toNumber() || 0,
        totalGamesPlayed: record.statistics?.totalGamesPlayed || 0,
      },
      currentLevel: record.currentLevel,
      totalXP: currentLevelXp,
      progressPercentage: progress,
      xpNeededForNextLevel: nextLevelXp,
      leaderboardRank,
      winRate: record.statistics?.totalGamesWon ? ((record.statistics?.totalGamesWon / record.statistics?.totalGamesPlayed * 100)).toFixed(2) : "0",
      privateProfile: false,
    };

    void this.profileCache
      .setPublic(query.username, dto, CACHE_TTL_SECONDS)
      .catch((err) =>
        this.logger.warn(
          `[GetPublicProfile] Cache write failed for ${query.username}`,
          err,
        ),
      );

    return Ok({...dto, isOnline: record.settings?.privateProfile ? false : (onlineStatus ?? false)});
  }
}
