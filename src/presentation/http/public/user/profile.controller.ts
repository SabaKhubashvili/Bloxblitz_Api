import {
  Controller,
  Get,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../../../../shared/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator.js';
import { DomainExceptionFilter } from '../../../../shared/filters/domain-exception.filter.js';
import { GetProfileUseCase } from '../../../../application/user/profile/use-cases/get-profile.use-case.js';

@Controller('user/profile')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class ProfileController {
  constructor(private readonly getProfileUseCase: GetProfileUseCase) {}

  @Get('get')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: JwtPayload) {
    const result = await this.getProfileUseCase.execute({
      username: user.username,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }
}
