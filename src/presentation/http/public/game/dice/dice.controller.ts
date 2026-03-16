import {
  Controller,
  Post,
  Get,
  Body,
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
import { RollDiceUseCase } from '../../../../../application/game/dice/use-cases/roll-dice.usecase';
import { GetDiceHistoryUseCase } from '../../../../../application/game/dice/use-cases/get-dice-history.usecase';
import { RollDiceHttpDto } from './dto/roll-dice.dto';
import { DiceHistoryQueryDto } from './dto/dice-history.dto';

@Controller('dice')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class DiceController {
  constructor(
    private readonly rollDiceUseCase: RollDiceUseCase,
    private readonly getDiceHistoryUseCase: GetDiceHistoryUseCase,
  ) {}

  @Post('roll')
  @HttpCode(HttpStatus.OK)
  async roll(@CurrentUser() user: JwtPayload, @Body() dto: RollDiceHttpDto) {
    const rollMode = typeof dto.rollMode === 'string'
      ? (dto.rollMode.toUpperCase() as 'OVER' | 'UNDER')
      : dto.rollMode;

    const result = await this.rollDiceUseCase.execute({
      username: user.username,
      profilePicture: user.profilePicture,
      betAmount: dto.betAmount,
      chance: dto.chance,
      rollMode,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get('history')
  async getHistory(
    @CurrentUser() user: JwtPayload,
    @Query() query: DiceHistoryQueryDto,
  ) {
    const result = await this.getDiceHistoryUseCase.execute({
      username: user.username,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      order: query.order ?? 'desc',
    });

    if (!result.ok) throw result.error;
    return result.value;
  }
}
