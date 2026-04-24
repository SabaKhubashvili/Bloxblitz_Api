import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/guards/roles.guard';
import { Roles } from '../../../../shared/decorators/roles.decorator';
import { UserRole } from '../../../../shared/enums/user-role.enum';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../shared/filters/domain-exception.filter';
import { GetUserLevelUseCase } from '../../../../application/user/leveling/use-cases/get-user-level.use-case';
import { AddExperienceUseCase } from '../../../../application/user/leveling/use-cases/add-experience.use-case';
import { SetUserLevelUseCase } from '../../../../application/user/leveling/use-cases/set-user-level.use-case';
import { GetTierByLevelUseCase } from '../../../../application/user/leveling/use-cases/get-tier-by-level.use-case';
import { AddExperienceHttpDto } from './dto/add-experience.http-dto';
import { SetUserLevelHttpDto } from './dto/set-user-level.http-dto';

/**
 * Leveling HTTP controller.
 *
 * Access levels:
 *   GET  /levels/me                    → authenticated user (own data)
 *   POST /levels/admin/:username/experience → staff only (grant XP)
 *   PATCH /levels/admin/:username      → staff only (set level)
 *   GET  /levels/:level/tier           → public (deterministic calculation)
 */
@Controller('levels')
@UseFilters(DomainExceptionFilter)
export class LevelsController {
  constructor(
    private readonly getUserLevelUseCase: GetUserLevelUseCase,
    private readonly addExperienceUseCase: AddExperienceUseCase,
    private readonly setUserLevelUseCase: SetUserLevelUseCase,
    private readonly getTierByLevelUseCase: GetTierByLevelUseCase,
  ) {}

  /**
   * GET /levels/me
   * Returns the full level progress for the authenticated user.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getUserLevel(@CurrentUser() user: JwtPayload) {
    const result = await this.getUserLevelUseCase.execute({
      username: user.username,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  /**
   * POST /levels/admin/:username/experience
   * Grants XP to the specified user.  Restricted to ADMIN / OWNER.
   */
  @Post('admin/:username/experience')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async addExperience(
    @Param('username') username: string,
    @Body() dto: AddExperienceHttpDto,
  ) {
    const result = await this.addExperienceUseCase.execute({
      username,
      amount: dto.amount,
      source: dto.source,
      referenceId: dto.referenceId,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  /**
   * PATCH /levels/admin/:username
   * Administratively overrides a user's level.  Restricted to ADMIN / OWNER.
   */
  @Patch('admin/:username')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OWNER)
  async setUserLevel(
    @Param('username') username: string,
    @Body() dto: SetUserLevelHttpDto,
  ) {
    const result = await this.setUserLevelUseCase.execute({
      username,
      level: dto.level,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  /**
   * GET /levels/:level/tier
   * Returns the tier name and number for a given level.
   * Public — no authentication required.
   */
  @Get(':level/tier')
  async getTierByLevel(@Param('level', ParseIntPipe) level: number) {
    const result = await this.getTierByLevelUseCase.execute({ level });
    if (!result.ok) throw result.error;
    return result.value;
  }
}
