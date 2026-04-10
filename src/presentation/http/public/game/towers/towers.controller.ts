import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../../../shared/guards/optional-jwt-auth.guard';
import type { JwtPayload } from '../../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { StartTowersGameUseCase } from '../../../../../application/game/towers/use-cases/start-towers-game.use-case';
import { GetActiveTowersGameUseCase } from '../../../../../application/game/towers/use-cases/get-active-towers-game.use-case';
import { RevealTowersTileUseCase } from '../../../../../application/game/towers/use-cases/reveal-towers-tile.use-case';
import { CashoutTowersGameUseCase } from '../../../../../application/game/towers/use-cases/cashout-towers-game.use-case';
import { StartTowersHttpDto } from './dto/start-towers.dto';
import { RevealTowersTileHttpDto } from './dto/reveal-towers-tile.dto';
import { VerifyTowersGameUseCase } from '../../../../../application/game/towers/use-cases/verify-towers-game.use-case';
import { VerifyTowersHttpDto } from './dto/verify-towers.dto';
import { TowersDifficulty } from '../../../../../domain/game/towers/towers.enums';

@Controller('games/towers')
@UseFilters(DomainExceptionFilter)
export class TowersController {
  constructor(
    private readonly startTowersGame: StartTowersGameUseCase,
    private readonly getActiveTowersGame: GetActiveTowersGameUseCase,
    private readonly revealTowersTile: RevealTowersTileUseCase,
    private readonly cashoutTowersGame: CashoutTowersGameUseCase,
    private readonly verifyTowersGame: VerifyTowersGameUseCase,
  ) {}

  @Post('start')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async start(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartTowersHttpDto,
  ) {
    const result = await this.startTowersGame.execute({
      username: user.username,
      profilePicture: user.profilePicture ?? '',
      betAmount: dto.betAmount,
      difficulty: dto.difficulty,
      levels: dto.levels,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Get('active')
  @UseGuards(OptionalJwtAuthGuard)
  async active(@Req() req: Request) {
    const user = req['user'] as JwtPayload | undefined; 
    const result = await this.getActiveTowersGame.execute({
      username: user?.username,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('reveal')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async reveal(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RevealTowersTileHttpDto,
  ) {
    const result = await this.revealTowersTile.execute({
      username: user.username,
      rowIndex: dto.rowIndex,
      tileIndex: dto.tileIndex,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('cashout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cashout(@CurrentUser() user: JwtPayload) {
    const result = await this.cashoutTowersGame.execute({
      username: user.username,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: VerifyTowersHttpDto) {
    return this.verifyTowersGame.execute({
      serverSeed: dto.serverSeed,
      clientSeed: dto.clientSeed,
      nonce: dto.nonce,
      difficulty: dto.difficulty as TowersDifficulty,
      levels: dto.levels,
      expectedGemIndicesByRow: dto.expectedGemIndicesByRow,
    });
  }
}
