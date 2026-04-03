import {
  Body,
  Controller,
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
import { RewardCaseKeysService } from '../../../../../../application/rewards/reward-cases/reward-case-keys.service';
import { OpenRewardCaseHttpDto } from './dto/open-reward-case.http-dto';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

@Controller('rewards/level-cases')
@UseFilters(DomainExceptionFilter)
export class RewardCasesController {
  constructor(private readonly rewardCases: RewardCaseKeysService) {}

  /** Public catalog (position, art, pool metadata). */
  @Get()
  async listCatalog() {
    return this.rewardCases.listDefinitions();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async myBalances(@CurrentUser() user: JwtPayload) {
    const [definitions, balances, totalXp, lastCaseOpen] = await Promise.all([
      this.rewardCases.listDefinitions(),
      this.rewardCases.getKeyBalances(user.username),
      this.rewardCases.getUserTotalXp(user.username),
      this.rewardCases.getLastCaseOpenForUser(user.username),
    ]);
    const xpMilestoneProgress = await this.rewardCases.getXpMilestoneProgress(
      user.username,
      totalXp,
    );
    return {
      definitions,
      keyBalances: balances,
      xpMilestoneProgress,
      lastCaseOpen,
    };
  }

  @Post('open')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async open(
    @CurrentUser() user: JwtPayload,
    @Body() dto: OpenRewardCaseHttpDto,
  ) {
    try {
      return await this.rewardCases.openCase(user.username, dto.slug.trim());
    } catch (e) {
      const code = e instanceof Error ? e.message : 'UNKNOWN';
      if (code === 'REWARD_CASE_NOT_FOUND') {
        throw new BadRequestException('Unknown reward case');
      }
      if (code === 'REWARD_CASE_EMPTY') {
        throw new BadRequestException('Case pool is not configured');
      }
      if (code === 'REWARD_CASE_COOLDOWN') {
        throw new ForbiddenException(
          'You can open this case again after 24 hours',
        );
      }
      if (code === 'CASE_GLOBAL_COOLDOWN') {
        throw new ForbiddenException(
          'You can only open one case every 24 hours',
        );
      }
      if (code === 'REWARD_CASE_INSUFFICIENT_KEYS') {
        throw new BadRequestException('Not enough keys for this case');
      }
      if (code === 'REWARD_CASE_ROLL_FAILED') {
        throw new BadRequestException('Could not roll rewards');
      }
      throw e;
    }
  }
}
