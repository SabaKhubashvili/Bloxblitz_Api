import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { GameSaveProcessor } from './game-save.processor';
import { GAME_SAVE_QUEUE } from './game-save.job-data';
import { TowersGameRepository } from '../../persistance/repositories/game/towers-game.repository';
import { PrismaDiceHistoryRepository } from '../../persistance/repositories/game/dice-history.repository';
import { MinesGameRepository } from '../../persistance/repositories/game/mines-game.repository';
import { UserSeedRepository } from '../../persistance/repositories/user/user-seed.repository';
import { USER_SEED_REPOSITORY } from '../../../application/game/dice/tokens/dice.tokens';
import { ProvablyFairModule } from '../../../modules/user/provably-fair.module';

/**
 * Single BullMQ queue `game-save` and worker for Towers / Dice / Mines DB persistence.
 * Import this module anywhere `InjectQueue(GAME_SAVE_QUEUE)` is needed.
 */
@Global()
@Module({
  imports: [
    ProvablyFairModule,
    BullModule.registerQueue({
      name: GAME_SAVE_QUEUE,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    }),
  ],
  providers: [
    GameSaveProcessor,
    TowersGameRepository,
    PrismaDiceHistoryRepository,
    MinesGameRepository,
    { provide: USER_SEED_REPOSITORY, useClass: UserSeedRepository },
  ],
  exports: [BullModule],
})
export class GameSaveModule {}
