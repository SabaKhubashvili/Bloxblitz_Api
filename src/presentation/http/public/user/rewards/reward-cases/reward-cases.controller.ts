import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
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
import type { IRewardCasesCachePort } from '../../../../../../application/rewards/reward-cases/ports/reward-cases-cache.port';
import { REWARD_CASES_CACHE_PORT } from '../../../../../../application/rewards/reward-cases/tokens/reward-cases.tokens';
import { PrismaService } from '../../../../../../infrastructure/persistance/prisma/prisma.service';

const REWARD_CASE_OPEN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

@Controller('rewards/level-cases')
@UseFilters(DomainExceptionFilter)
export class RewardCasesController {
  private readonly logger = new Logger(RewardCasesController.name);

  constructor(
    private readonly rewardCases: RewardCaseKeysService,
    private readonly openRewardCase: OpenRewardCaseUseCase,
    @Inject(REWARD_CASES_CACHE_PORT)
    private readonly rewardCasesCache: IRewardCasesCachePort,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 24h cooldown for **reward** level cases only (not paid shop cases).
   * Declared before `@Get()` so `cooldown` is not treated as a param.
   */
  @Get('cooldown')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getRewardCaseCooldownStatus(@CurrentUser() user: JwtPayload): Promise<{
    onCooldown: boolean;
    cooldownEndsAt: string | null;
  }> {
    let lastOpenMs = 0;

    try {
      const ts = await this.rewardCasesCache.getCooldownTimestamp(
        user.username,
      );
      if (ts !== null && Number.isFinite(ts) && ts > 0) {
        lastOpenMs = Math.max(lastOpenMs, ts);
      }
    } catch (err) {
      this.logger.warn(
        `[RewardCases] cooldown cache read failed for user=${user.username}`,
        err,
      );
    }

    try {
      const row = await this.prisma.rewardCaseOpen.findFirst({
        where: { userUsername: user.username },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (row) {
        const t = row.createdAt.getTime();
        if (Number.isFinite(t)) lastOpenMs = Math.max(lastOpenMs, t);
      }
    } catch (err) {
      this.logger.warn(
        `[RewardCases] cooldown DB read failed for user=${user.username}`,
        err,
      );
    }

    if (lastOpenMs <= 0) {
      return { onCooldown: false, cooldownEndsAt: null };
    }

    const cooldownEndsAt = new Date(lastOpenMs + REWARD_CASE_OPEN_COOLDOWN_MS);
    const onCooldown = cooldownEndsAt.getTime() > Date.now();
    return {
      onCooldown,
      cooldownEndsAt: onCooldown ? cooldownEndsAt.toISOString() : null,
    };
  }

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
        throw new ForbiddenException(
          'You can only open one case every 24 hours',
        );
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
