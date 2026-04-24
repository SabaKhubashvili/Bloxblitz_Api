import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import type { JwtPayload } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../shared/filters/domain-exception.filter';
import { RakebackType } from '../../../../domain/rakeback/enums/rakeback-type.enum';
import { GetRakebackDataUseCase } from '../../../../application/user/rakeback/use-cases/get-rakeback-data.use-case';
import { ClaimRakebackUseCase } from '../../../../application/user/rakeback/use-cases/claim-rakeback.use-case';

@Controller('rakeback')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class RakebackController {
  constructor(
    private readonly getRakebackDataUseCase: GetRakebackDataUseCase,
    private readonly claimRakebackUseCase: ClaimRakebackUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getRakebackData(@CurrentUser() user: JwtPayload) {
    const result = await this.getRakebackDataUseCase.execute({
      username: user.username,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  @Post('claim/:type')
  @HttpCode(HttpStatus.OK)
  async claimRakeback(
    @CurrentUser() user: JwtPayload,
    @Param('type') type: string,
  ) {
    const rakebackType = this.parseType(type);

    const result = await this.claimRakebackUseCase.execute({
      username: user.username,
      type: rakebackType,
    });
    if (!result.ok) throw result.error;
    return result.value;
  }

  private parseType(raw: string): RakebackType {
    const upper = raw.toUpperCase();
    if (upper === 'DAILY') return RakebackType.DAILY;
    if (upper === 'WEEKLY') return RakebackType.WEEKLY;
    if (upper === 'MONTHLY') return RakebackType.MONTHLY;
    throw new Error(`Invalid rakeback type: ${raw}`);
  }
}
