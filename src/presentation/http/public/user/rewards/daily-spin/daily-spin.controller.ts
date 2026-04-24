import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../../../shared/filters/domain-exception.filter';
import { SpinDailyWheelUseCase } from '../../../../../../application/rewards/daily-spin/use-cases/spin-daily-wheel.use-case';
import { GetDailySpinStatusUseCase } from '../../../../../../application/rewards/daily-spin/use-cases/get-daily-spin-status.use-case';
import { GetDailySpinHistoryUseCase } from '../../../../../../application/rewards/daily-spin/use-cases/get-daily-spin-history.use-case';
import { DailySpinHistoryQueryDto } from './dto/daily-spin.http-dto';

/**
 * Daily Spin HTTP controller.
 *
 * All routes are JWT-protected.
 *
 * Routes (relative to global prefix /api/v1):
 *   POST /rewards/daily-spin/spin    — execute a spin
 *   GET  /rewards/daily-spin/status  — check spin availability + current tier
 *   GET  /rewards/daily-spin/history — paginated spin history for the caller
 */
@Controller('rewards/daily-spin')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class DailySpinController {
  constructor(
    private readonly spinDailyWheelUseCase: SpinDailyWheelUseCase,
    private readonly getDailySpinStatusUseCase: GetDailySpinStatusUseCase,
    private readonly getDailySpinHistoryUseCase: GetDailySpinHistoryUseCase,
  ) {}

  /**
   * POST /api/v1/rewards/daily-spin/spin
   *
   * Executes a daily spin for the authenticated user.
   * Returns the prize won and the timestamp for the next available spin.
   */
  @Post('spin')
  @HttpCode(HttpStatus.OK)
  async spin(@CurrentUser() user: JwtPayload) {
    const result = await this.spinDailyWheelUseCase.execute({
      username: user.username,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  /**
   * GET /api/v1/rewards/daily-spin/status
   *
   * Returns whether the user can currently spin, the time of the next
   * available spin, and their current prize-tier based on 30-day wager.
   */
  @Get('status')
  async getStatus(@CurrentUser() user: JwtPayload) {
    const result = await this.getDailySpinStatusUseCase.execute({
      username: user.username,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  /**
   * GET /api/v1/rewards/daily-spin/history?page=1&limit=20
   *
   * Returns a paginated list of the caller's past spin results.
   */
  @Get('history')
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: DailySpinHistoryQueryDto,
  ) {
    const result = await this.getDailySpinHistoryUseCase.execute({
      username: user.username,
      page: query.page,
      limit: query.limit,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }
}
