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
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { GetUserBetHistoryUseCase } from '../../../../../application/game/bet-history/use-cases/get-user-bet-history.use-case';
import { GetBetByIdUseCase } from '../../../../../application/game/bet-history/use-cases/get-bet-by-id.use-case';
import { BetHistoryQueryDto } from './dto/bet-history-query.dto';

@Controller('bets/history')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class BetHistoryController {
  constructor(
    private readonly getHistoryUseCase: GetUserBetHistoryUseCase,
    private readonly getBetByIdUseCase: GetBetByIdUseCase,
  ) {}

  /**
   * GET /bets/history?page=1&limit=10&order=desc&gameType=MINES
   *
   * Returns a paginated list of the authenticated user's bet history
   * across game types (MINES, CRASH, COINFLIP, DICE, CASE, ROULETTE, TOWERS, …), sorted newest-first.
   * Optionally filter by gameType.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: BetHistoryQueryDto,
  ) {
    const result = await this.getHistoryUseCase.execute({
      username: user.username,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      order: (query.order ?? 'desc') as 'desc' | 'asc',
      gameType: query.gameType,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }

  /**
   * GET /bets/history/:id
   *
   * Returns a single bet by its game ID.
   * Ownership is enforced — the bet must belong to the authenticated user.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getBet(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const result = await this.getBetByIdUseCase.execute({
      gameId: id,
      username: user.username,
  });

    if (!result.ok) throw result.error;
    return result.value;
  }
}
