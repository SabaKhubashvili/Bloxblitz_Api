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
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { RotateClientSeedDto } from './dto/rotate-client-seed.dto';
import { GetProvablyFairDataUseCase } from '../../../../../application/user/provably-fair/use-cases/get-provably-fair-data.use-case';
import { RotateClientSeedUseCase } from '../../../../../application/user/provably-fair/use-cases/rotate-client-seed.use-case';

@Controller('user/provably-fair')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class ProvablyFairController {
  constructor(
    private readonly getProvablyFairDataUseCase: GetProvablyFairDataUseCase,
    private readonly rotateClientSeedUseCase: RotateClientSeedUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getProvablyFairData(@CurrentUser() user: JwtPayload) {
    const result = await this.getProvablyFairDataUseCase.execute({
      username: user.username,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('rotate-client-seed')
  @HttpCode(HttpStatus.OK)
  async rotateClientSeed(
    @CurrentUser() user: JwtPayload,
    @Body() dto: RotateClientSeedDto,
  ) {
    const result = await this.rotateClientSeedUseCase.execute({
      username: user.username,
      clientSeed: dto.clientSeed,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }
}
