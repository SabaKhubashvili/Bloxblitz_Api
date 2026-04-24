import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseFilters,
} from '@nestjs/common';
import { DomainExceptionFilter } from '../../../../../shared/filters/domain-exception.filter';
import { VerifyCoinflipGameUseCase } from '../../../../../application/game/coinflip/use-cases/verify-coinflip-game.use-case';
import { VerifyCoinflipHttpDto } from './dto/verify-coinflip.dto';

@Controller('games/coinflip')
@UseFilters(DomainExceptionFilter)
export class CoinflipVerifyController {
  constructor(private readonly verifyCoinflip: VerifyCoinflipGameUseCase) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  verify(@Body() dto: VerifyCoinflipHttpDto) {
    return this.verifyCoinflip.execute({
      serverSeed: dto.serverSeed,
      eosBlockId: dto.eosBlockId,
      nonce: dto.nonce,
      publicServerSeed: dto.publicServerSeed,
      expectedRandomValue: dto.expectedRandomValue,
    });
  }
}
