import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
} from '@nestjs/common';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { VerifyDiceGameUseCase } from '../../../../../application/game/dice/use-cases/verify-dice-game.use-case';
import { VerifyDiceHttpDto } from './dto/verify-dice.dto';

@Controller('dice')
@UseFilters(DomainExceptionFilter)
export class DiceVerifyController {
  constructor(private readonly verifyDice: VerifyDiceGameUseCase) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: VerifyDiceHttpDto) {
    const rollMode = dto.rollMode.toUpperCase() as 'OVER' | 'UNDER';
    return this.verifyDice.execute({
      serverSeed: dto.serverSeed,
      clientSeed: dto.clientSeed,
      nonce: dto.nonce,
      chance: dto.chance,
      rollMode,
      expectedRollResult: dto.expectedRollResult,
    });
  }
}
