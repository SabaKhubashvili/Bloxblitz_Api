import { Controller, Post, Body, Req, UseGuards, UseFilters } from '@nestjs/common';
import { JwtAuthGuard } from '../../../../shared/guards/jwt-auth.guard';
import { CurrentUser } from '../../../../shared/decorators/current-user.decorator';
import { DomainExceptionFilter } from '../../../../shared/filters/domain-exception.filter';
import type { JwtPayload } from '../../../../shared/guards/jwt-auth.guard';
import { RedeemKinguinCodeUseCase } from '../../../../application/kinguin/use-cases/redeem-kinguin-code.use-case';
import { RedeemKinguinPromoCodeDto } from './dto/redeem-kinguin-code.http-dto';
import type { Request } from 'express';

@Controller('kinguin')
@UseGuards(JwtAuthGuard)
@UseFilters(DomainExceptionFilter)
export class KinguinController {
  constructor(private readonly redeemUseCase: RedeemKinguinCodeUseCase) {}

  @Post('redeem')
  async redeemCode(
    @CurrentUser() user: JwtPayload,
    @Body() body: RedeemKinguinPromoCodeDto,
    @Req() req: Request,
  ) {
    const result = await this.redeemUseCase.execute({
      username: user.username,
      code: body.promoCode,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    if (!result.ok) throw result.error;
    return result.value;
  }
}
