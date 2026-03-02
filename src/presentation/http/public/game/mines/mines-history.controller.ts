import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../../../../../shared/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator.js';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter.js';
import { GetUserMinesHistoryUseCase } from '../../../../../application/game/mines/use-cases/get-user-mines-history.use-case.js';
import { GetMinesRoundByIdUseCase } from '../../../../../application/game/mines/use-cases/get-mines-round-by-id.use-case.js';
import { MinesHistoryQueryDto } from './dto/mines-history-query.dto.js';

@Controller('games/mines/history')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class MinesHistoryController {
  constructor(
    private readonly getHistoryUseCase: GetUserMinesHistoryUseCase,
    private readonly getRoundUseCase: GetMinesRoundByIdUseCase,
  ) {}

  /**
   * GET /games/mines/history?page=1&limit=10
   *
   * Returns a paginated list of the authenticated user's Mines rounds,
   * sorted newest-first.  Results are served from Redis when cached.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: MinesHistoryQueryDto,
  ) {
    const result = await this.getHistoryUseCase.execute({
      username: user.username,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      order: (query.order ?? 'desc') as 'desc' | 'asc',
    });

    if (!result.ok) throw result.error;
    return result.value;
  }

  /**
   * GET /games/mines/history/:id
   *
   * Returns a single Mines round by its game ID.
   * Ownership is enforced — the round must belong to the authenticated user.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getRound(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.getRoundUseCase.execute({
      gameId: id,
      username: user.username,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }
}
