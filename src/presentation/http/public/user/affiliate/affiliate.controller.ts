import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';

import { ClaimReferralEarningsUseCase } from '../../../../../application/user/affiliate/use-cases/claim-referral-earnings.use-case';
import { CreateOwnReferralCodeUseCase } from '../../../../../application/user/affiliate/use-cases/create-own-referral-code.use-case';
import { GetAffiliateReferralsUseCase } from '../../../../../application/user/affiliate/use-cases/get-affiliate-referrals.use-case';
import { GetAffiliateStatsUseCase } from '../../../../../application/user/affiliate/use-cases/get-affiliate-stats.use-case';
import { GetAffiliateSummaryUseCase } from '../../../../../application/user/affiliate/use-cases/get-affiliate-summary.use-case';
import { GetUsedReferralCodeUseCase } from '../../../../../application/user/affiliate/use-cases/get-used-referral-code.use-case';
import { UseReferralCodeUseCase } from '../../../../../application/user/affiliate/use-cases/use-referral-code.use-case';

import type {
  AffiliateReferralsRange,
  AffiliateStatsRange,
} from '../../../../../domain/referral/ports/affiliate.repository.port';

import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import type { JwtPayload } from '../../../../../shared/guards/jwt-auth.guard';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';

import { AffiliateCodeBodyDto } from './dto/affiliate-code-body.dto';
import {
  AffiliateReferralsQueryDto,
  AffiliateReferralsRangeParam,
} from './dto/affiliate-referrals-query.dto';
import { AffiliateStatsQueryDto } from './dto/affiliate-stats-query.dto';

@Controller('affiliate')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class AffiliateController {
  constructor(
    private readonly getUsedReferralCodeUseCase: GetUsedReferralCodeUseCase,
    private readonly useReferralCodeUseCase: UseReferralCodeUseCase,
    private readonly createOwnReferralCodeUseCase: CreateOwnReferralCodeUseCase,
    private readonly getAffiliateStatsUseCase: GetAffiliateStatsUseCase,
    private readonly getAffiliateSummaryUseCase: GetAffiliateSummaryUseCase,
    private readonly claimReferralEarningsUseCase: ClaimReferralEarningsUseCase,
    private readonly getAffiliateReferralsUseCase: GetAffiliateReferralsUseCase,
  ) {}

  @Get('used-code')
  @HttpCode(HttpStatus.OK)
  async getUsedCode(@CurrentUser() user: JwtPayload) {
    const result = await this.getUsedReferralCodeUseCase.execute({
      username: user.username,
    });
    if (!result.ok) throw result.error;
    return {
      code: result.value.code,
      lastChangedAt: result.value.lastChangedAt,
    };
  }

  @Post('use-code')
  @HttpCode(HttpStatus.OK)
  async useCode(
    @CurrentUser() user: JwtPayload,
    @Body() body: AffiliateCodeBodyDto,
  ) {
    const result = await this.useReferralCodeUseCase.execute({
      username: user.username,
      code: body.code,
    });
    if (!result.ok) throw result.error;
    return {
      code: result.value.code,
      lastChangedAt: result.value.lastChangedAt,
    };
  }

  @Post('create-code')
  @HttpCode(HttpStatus.CREATED)
  async createCode(
    @CurrentUser() user: JwtPayload,
    @Body() body: AffiliateCodeBodyDto,
  ) {
    const result = await this.createOwnReferralCodeUseCase.execute({
      username: user.username,
      code: body.code,
    });
    if (!result.ok) throw result.error;
    return {
      code: result.value.code,
      createdAt: result.value.createdAt,
    };
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(
    @CurrentUser() user: JwtPayload,
    @Query() query: AffiliateStatsQueryDto,
  ) {
    const result = await this.getAffiliateStatsUseCase.execute({
      username: user.username,
      range: query.range as AffiliateStatsRange,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getSummary(@CurrentUser() user: JwtPayload) {
    const result = await this.getAffiliateSummaryUseCase.execute({
      username: user.username,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('claim')
  @HttpCode(HttpStatus.OK)
  async claim(@CurrentUser() user: JwtPayload) {
    const result = await this.claimReferralEarningsUseCase.execute({
      username: user.username,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get('referrals')
  @HttpCode(HttpStatus.OK)
  async listReferrals(
    @CurrentUser() user: JwtPayload,
    @Query() query: AffiliateReferralsQueryDto,
  ) {
    const range = mapReferralsRange(query.range);
    const result = await this.getAffiliateReferralsUseCase.execute({
      username: user.username,
      range,
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }
}

function mapReferralsRange(
  param: AffiliateReferralsRangeParam,
): AffiliateReferralsRange {
  switch (param) {
    case AffiliateReferralsRangeParam.ALL:
      return 'all';
    case AffiliateReferralsRangeParam.D7:
      return '7d';
    case AffiliateReferralsRangeParam.D30:
      return '30d';
    case AffiliateReferralsRangeParam.D90:
      return '90d';
    default:
      return 'all';
  }
}
