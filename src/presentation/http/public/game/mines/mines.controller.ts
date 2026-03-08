import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsInt, IsNumber, Min, Max } from 'class-validator';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { CreateMinesGameUseCase } from '../../../../../application/game/mines/use-cases/create-mines-game.use-case';
import { RevealTileUseCase } from '../../../../../application/game/mines/use-cases/reveal-tile.use-case';
import { CashoutMinesGameUseCase } from '../../../../../application/game/mines/use-cases/cashout-mines-game.use-case';
import { GetActiveMinesGameUseCase } from '../../../../../application/game/mines/use-cases/get-active-mines-game.use-case';
import { CreateMinesHttpDto } from './dto/create-mines-game.dto';
import { RevealTileHttpDto } from './dto/reveal-mines-tile.dto';




@Controller('games/mines')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class MinesController {
  constructor(
    private readonly createGameUseCase: CreateMinesGameUseCase,
    private readonly revealTileUseCase: RevealTileUseCase,
    private readonly cashoutUseCase: CashoutMinesGameUseCase,
    private readonly getActiveGameUseCase: GetActiveMinesGameUseCase,
  ) {}

  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMinesHttpDto) {
    console.log(dto);
    
    
    const result = await this.createGameUseCase.execute({
      username: user.username,
      betAmount: dto.betAmount,
      mineCount: dto.mineCount,
      gridSize: dto.gridSize * dto.gridSize,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('reveal')
  @HttpCode(HttpStatus.OK)
  async reveal(@CurrentUser() user: JwtPayload, @Body() dto: RevealTileHttpDto) {
    const result = await this.revealTileUseCase.execute({
      username: user.username,
      tileIndex: dto.tileIndex,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('cashout')
  @HttpCode(HttpStatus.OK)
  async cashout(@CurrentUser() user: JwtPayload) {
    const result = await this.cashoutUseCase.execute({ username: user.username });

    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get('active')
  async getActive(@CurrentUser() user: JwtPayload) {
    const result = await this.getActiveGameUseCase.execute({ username: user.username });

    if (!result.ok) throw result.error;
    return result.value;
  }
}
