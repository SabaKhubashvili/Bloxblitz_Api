import { Body, Controller, HttpCode, HttpStatus, Post, UseFilters } from '@nestjs/common';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { VerifyCaseOpenUseCase } from '../../../../../application/game/case/use-cases/verify-case-open.use-case';
import { VerifyCaseHttpDto } from './dto/verify-case.dto';

@Controller('cases')
@UseFilters(DomainExceptionFilter)
export class CaseVerifyController {
  constructor(private readonly verifyCase: VerifyCaseOpenUseCase) {}

  @Post('verify-open')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() dto: VerifyCaseHttpDto) {
    return this.verifyCase.execute({
      slug: dto.slug,
      serverSeed: dto.serverSeed,
      clientSeed: dto.clientSeed,
      nonce: dto.nonce,
      expectedWonCaseItemId: dto.expectedWonCaseItemId,
      expectedNormalizedRoll: dto.expectedNormalizedRoll,
    });
  }
}
