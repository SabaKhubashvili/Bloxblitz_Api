import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
} from '@nestjs/common';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { VerifyRouletteOutcomeUseCase } from '../../../../../application/game/roulette/use-cases/verify-roulette-outcome.use-case';
import { VerifyRouletteHttpDto } from './dto/verify-roulette.dto';

@Controller('games/roulette')
@UseFilters(DomainExceptionFilter)
export class RouletteVerifyController {
  constructor(private readonly verifyRoulette: VerifyRouletteOutcomeUseCase) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: VerifyRouletteHttpDto) {
    return this.verifyRoulette.execute({
      serverSeed: dto.serverSeed,
      eosBlockId: dto.eosBlockId,
      gameIndex: dto.gameIndex,
      expectedOutcome: dto.expectedOutcome,
      expectedOutcomeHash: dto.expectedOutcomeHash,
    });
  }
}
