import { Module } from '@nestjs/common';
import { CoinflipFairnessDomainService } from '../../domain/game/coinflip/coinflip-fairness.domain-service';
import { RouletteFairnessDomainService } from '../../domain/game/roulette/roulette-fairness.domain-service';
import { VerifyCoinflipGameUseCase } from '../../application/game/coinflip/use-cases/verify-coinflip-game.use-case';
import { VerifyRouletteOutcomeUseCase } from '../../application/game/roulette/use-cases/verify-roulette-outcome.use-case';
import { CoinflipVerifyController } from '../../presentation/http/public/game/coinflip/coinflip-verify.controller';
import { RouletteVerifyController } from '../../presentation/http/public/game/roulette/roulette-verify.controller';

@Module({
  controllers: [CoinflipVerifyController, RouletteVerifyController],
  providers: [
    CoinflipFairnessDomainService,
    RouletteFairnessDomainService,
    VerifyCoinflipGameUseCase,
    VerifyRouletteOutcomeUseCase,
  ],
})
export class GameFairnessVerifyModule {}
