import { Injectable, Inject, Logger } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IProfileRepository } from '../../../../domain/user/ports/profile.repository.port';
import type { IProfileCachePort } from '../ports/profile-cache.port';
import type { SetProfilePrivacyCommand } from '../dto/set-profile-privacy.command';
import type { SetProfilePrivacyOutputDto } from '../dto/set-profile-privacy.output-dto';
import {
  UserNotFoundError,
  type UserError,
} from '../../../../domain/user/errors/user.errors';
import {
  PROFILE_REPOSITORY,
  PROFILE_CACHE_PORT,
} from '../tokens/profile.tokens';

@Injectable()
export class SetProfilePrivacyUseCase implements IUseCase<
  SetProfilePrivacyCommand,
  Result<SetProfilePrivacyOutputDto, UserError>
> {
  private readonly logger = new Logger(SetProfilePrivacyUseCase.name);

  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly profileRepo: IProfileRepository,
    @Inject(PROFILE_CACHE_PORT)
    private readonly profileCache: IProfileCachePort,
  ) {}

  async execute(
    command: SetProfilePrivacyCommand,
  ): Promise<Result<SetProfilePrivacyOutputDto, UserError>> {
    const user = await this.profileRepo.findByUsername(command.username);
    if (!user) {
      return Err(new UserNotFoundError(command.username));
    }

    const updated = await this.profileRepo.updatePrivateProfile(
      command.username,
      command.privateProfile,
    );

    void this.profileCache
      .invalidate(command.username)
      .catch((err) =>
        this.logger.warn(
          `[SetProfilePrivacy] Cache invalidation failed for ${command.username}`,
          err,
        ),
      );
    void this.profileCache
      .invalidatePublic(command.username)
      .catch((err) =>
        this.logger.warn(
          `[SetProfilePrivacy] Cache invalidation failed for ${command.username}`,
          err,
        ),
      );

    return Ok({ privateProfile: updated.privateProfile });
  }
}
