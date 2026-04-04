import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../../../shared/filters/domain-exception.filter';
import { OptionalJwtAuthGuard } from 'src/shared/guards/optional-jwt-auth.guard';
import { RewardCaseKeysService } from '../../../../../../application/rewards/reward-cases/reward-case-keys.service';
import { OpenRewardCaseUseCase } from '../../../../../../application/rewards/reward-cases/use-cases/open-reward-case.use-case';
import {
  RewardCaseCooldownError,
  RewardCaseEmptyError,
  RewardCaseInsufficientKeysError,
  RewardCaseLevelLockedError,
  RewardCaseNotFoundError,
  RewardCaseRollFailedError,
} from '../../../../../../domain/reward-cases/errors/reward-case.errors';
import { OpenRewardCaseHttpDto } from './dto/open-reward-case.http-dto';

@Controller('rewards/level-cases')
@UseFilters(DomainExceptionFilter)
export class RewardCasesController {
  constructor(
    private readonly rewardCases: RewardCaseKeysService,
    private readonly openRewardCase: OpenRewardCaseUseCase,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async myBalances(@CurrentUser() user?: JwtPayload) {
    if (!user) {
      const definitions = await this.rewardCases.listDefinitions();
      return {
        definitions,
        keyBalances: {},
        totalXp: 0,
        userLevel: 0,
        lastCaseOpen: null,
      };
    }

    const [definitions, userState] = await Promise.all([
      this.rewardCases.listDefinitions(),
      this.rewardCases.getCachedUserState(user.username),
    ]);

    const definitionsWithUnlock = definitions.map((d) => ({
      ...d,
      isUnlocked:
        d.requiredLevel === 0 || userState.userLevel >= d.requiredLevel,
    }));

    return {
      definitions: definitionsWithUnlock,
      keyBalances: userState.keyBalances,
      xpMilestoneProgress: userState.xpMilestoneProgress,
      lastCaseOpen: userState.lastCaseOpen,
      userLevel: userState.userLevel,
    };
  }

  @Post('open')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async open(
    @CurrentUser() user: JwtPayload,
    @Body() dto: OpenRewardCaseHttpDto,
  ) {
    const result = await this.openRewardCase.execute({
      userUsername: user.username,
      slug: dto.slug.trim(),
    });

    if (!result.ok) {
      const err = result.error;

      if (err instanceof RewardCaseNotFoundError) {
        throw new BadRequestException('Unknown reward case');
      }
      if (err instanceof RewardCaseEmptyError) {
        throw new BadRequestException('Case pool is not configured');
      }
      if (err instanceof RewardCaseCooldownError) {
        throw new ForbiddenException('You can only open one case every 24 hours');
      }
      if (err instanceof RewardCaseInsufficientKeysError) {
        throw new BadRequestException('Not enough keys for this case');
      }
      if (err instanceof RewardCaseRollFailedError) {
        throw new BadRequestException('Could not roll rewards');
      }
      if (err instanceof RewardCaseLevelLockedError) {
        throw new ForbiddenException('Your level is too low to open this case');
      }

      throw new BadRequestException('Failed to open case');
    }

    return result.value;
  }
}
