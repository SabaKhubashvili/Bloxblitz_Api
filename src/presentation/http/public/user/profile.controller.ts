import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../shared/filters/domain-exception.filter';
import { GetProfileUseCase } from '../../../../application/user/profile/use-cases/get-profile.use-case';
import { SetProfilePrivacyUseCase } from '../../../../application/user/profile/use-cases/set-profile-privacy.use-case';
import { SetProfilePrivacyHttpDto } from './dto/set-profile-privacy.dto';

@Controller('user/profile')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class ProfileController {
  constructor(
    private readonly getProfileUseCase: GetProfileUseCase,
    private readonly setProfilePrivacyUseCase: SetProfilePrivacyUseCase,
  ) {}

  @Get('get')
  @HttpCode(HttpStatus.OK)
  async getProfile(@CurrentUser() user: JwtPayload) {
    const result = await this.getProfileUseCase.execute({
      username: user.username,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('set-private')
  @HttpCode(HttpStatus.OK)
  async setPrivate(
    @CurrentUser() user: JwtPayload,
    @Body() dto: SetProfilePrivacyHttpDto,
  ) {
    const result = await this.setProfilePrivacyUseCase.execute({
      username: user.username,
      privateProfile: dto.privateProfile,
    });

    if (!result.ok) throw result.error;
    return result.value;
  }
}
