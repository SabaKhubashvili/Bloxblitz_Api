import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { DomainExceptionFilter } from '../../../../shared/filters/domain-exception.filter';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../../../shared/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import type { JwtPayload } from '../../../../shared/guards/jwt-auth.guard';
import { GetCurrentRaceUseCase } from '../../../../application/race/use-cases/get-current-race.use-case';
import { GetPreviousRacesUseCase } from '../../../../application/race/use-cases/get-previous-races.use-case';
import { UpdateWagerOnActiveRaceUseCase } from '../../../../application/race/use-cases/update-wager-on-active-race.use-case';
import { FinishRaceUseCase } from '../../../../application/race/use-cases/finish-race.use-case';
import { CreateRaceWithRewardsUseCase } from '../../../../application/race/use-cases/create-race-with-rewards.use-case';
import {
  CreateRaceHttpDto,
  WagerOnActiveRaceHttpDto,
} from './dto/race.http-dto';

@Controller('race')
@UseFilters(DomainExceptionFilter)
export class RaceController {
  constructor(
    private readonly getCurrentRace: GetCurrentRaceUseCase,
    private readonly getPreviousRaces: GetPreviousRacesUseCase,
    private readonly updateWagerOnActiveRace: UpdateWagerOnActiveRaceUseCase,
    private readonly finishRace: FinishRaceUseCase,
    private readonly createRaceWithRewards: CreateRaceWithRewardsUseCase,
  ) {}

  @Get('current')
  @UseGuards(OptionalJwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getCurrent(@Req() req: Request) {
    const user = req['user'] as JwtPayload | undefined;
    const userUsername = user?.username ?? null;
    return this.getCurrentRace.execute(userUsername);
  }

  @Get('previous')
  @HttpCode(HttpStatus.OK)
  async getPrevious() {
    return this.getPreviousRaces.execute(0, 5);
  }

  @Post('wager')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async wager(
    @CurrentUser() user: JwtPayload,
    @Body() body: WagerOnActiveRaceHttpDto,
  ) {
    await this.updateWagerOnActiveRace.execute(user.username, body.amount);
  }

  @Post(':raceId/finish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async finish(@Param('raceId') raceId: string) {
    await this.finishRace.execute(raceId);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  async createRace(@Body() body: CreateRaceHttpDto) {
    return this.createRaceWithRewards.execute({
      startTime: new Date(body.startTime),
      endTime: new Date(body.endTime),
      rewards: body.rewards.map((r) => ({
        position: r.position,
        rewardAmount: r.rewardAmount,
      })),
    });
  }
}
