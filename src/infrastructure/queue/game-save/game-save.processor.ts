import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import type { IUserSeedRepository } from '../../../domain/user/ports/user-seed.repository.port';
import { USER_SEED_REPOSITORY } from '../../../application/game/dice/tokens/dice.tokens';
import { MinesGame } from '../../../domain/game/mines/entities/mines-game.entity';
import { MineMask } from '../../../domain/game/mines/value-objects/mine-mask.vo';
import { Money } from '../../../domain/shared/value-objects/money.vo';
import { TowersGameRepository } from '../../persistance/repositories/game/towers-game.repository';
import { PrismaDiceHistoryRepository } from '../../persistance/repositories/game/dice-history.repository';
import { MinesGameRepository } from '../../persistance/repositories/game/mines-game.repository';
import {
  DICE_SAVE_BET_JOB_NAME,
  GAME_SAVE_QUEUE,
  MINES_SAVE_INITIAL_JOB_NAME,
  TOWERS_SAVE_GAME_JOB_NAME,
  type DiceSaveBetJobData,
  type MinesSaveInitialJobData,
  type TowersSaveGameJobData,
} from './game-save.job-data';

@Injectable()
@Processor(GAME_SAVE_QUEUE, { concurrency: 16 })
export class GameSaveProcessor extends WorkerHost {
  private readonly logger = new Logger(GameSaveProcessor.name);

  constructor(
    private readonly towersRepo: TowersGameRepository,
    private readonly diceHistoryRepo: PrismaDiceHistoryRepository,
    private readonly minesRepo: MinesGameRepository,
    @Inject(USER_SEED_REPOSITORY)
    private readonly userSeedRepo: IUserSeedRepository,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    switch (job.name) {
      case TOWERS_SAVE_GAME_JOB_NAME:
        return this.processTowers(job as Job<TowersSaveGameJobData>);
      case DICE_SAVE_BET_JOB_NAME:
        return this.processDice(job as Job<DiceSaveBetJobData>);
      case MINES_SAVE_INITIAL_JOB_NAME:
        return this.processMinesInitial(job as Job<MinesSaveInitialJobData>);
      default:
        this.logger.error(
          `[game-save] unknown job name=${String(job.name)} jobId=${job.id} data=${JSON.stringify(job.data)}`,
        );
        throw new UnrecoverableError(`Unknown job name: ${String(job.name)}`);
    }
  }

  private async processTowers(job: Job<TowersSaveGameJobData>): Promise<void> {
    const started = Date.now();
    const data = job.data;
    try {
      const { entity, inserted } = await this.towersRepo.createWithReservedIds({
        userUsername: data.userUsername,
        betAmount: data.betAmount,
        difficulty: data.difficulty,
        levels: data.levels,
        rowConfigs: data.rowConfigs,
        picks: data.picks,
        multiplierLadder: data.multiplierLadder,
        serverSeed: data.serverSeed,
        serverSeedHash: data.serverSeedHash,
        clientSeed: data.clientSeed,
        nonce: data.nonce,
        gameHistoryId: data.gameHistoryId,
        towersRowId: data.towersRowId,
      });

      if (inserted) {
        void this.userSeedRepo
          .incrementTotalGamesPlayed(data.userUsername.toLowerCase(), 1)
          .catch((e) =>
            this.logger.warn(
              `[game-save] towers totalGamesPlayed increment failed user=${data.userUsername} gameHistoryId=${data.gameHistoryId}`,
              e,
            ),
          );
      }

      this.logger.log(
        `[game-save] ${TOWERS_SAVE_GAME_JOB_NAME} ok jobId=${job.id} gameHistoryId=${entity.gameHistoryId} inserted=${inserted} processDurationMs=${Date.now() - started}`,
      );
    } catch (err) {
      this.logJobError(TOWERS_SAVE_GAME_JOB_NAME, job, data, err);
      throw err;
    }
  }

  private async processDice(job: Job<DiceSaveBetJobData>): Promise<void> {
    const started = Date.now();
    const data = job.data;
    try {
      const { inserted } = await this.diceHistoryRepo.saveBetIdempotent(data);
      this.logger.log(
        `[game-save] ${DICE_SAVE_BET_JOB_NAME} ok jobId=${job.id} betId=${data.id} inserted=${inserted} processDurationMs=${Date.now() - started}`,
      );
    } catch (err) {
      this.logJobError(DICE_SAVE_BET_JOB_NAME, job, data, err);
      throw err;
    }
  }

  private async processMinesInitial(
    job: Job<MinesSaveInitialJobData>,
  ): Promise<void> {
    const started = Date.now();
    const data = job.data;
    try {
      const mineMask = new MineMask(new Set(data.minePositions));
      const gameResult = MinesGame.create({
        id: data.gameId,
        username: data.username,
        profilePicture: data.profilePicture,
        betAmount: new Money(data.betAmount),
        mineCount: data.mineCount,
        mineMask,
        nonce: data.nonce,
        gridSize: data.gridSize,
        houseEdge: data.houseEdge,
      });
      if (!gameResult.ok) {
        throw new UnrecoverableError(
          `Invalid mines snapshot: ${gameResult.error.message}`,
        );
      }

      const { inserted } = await this.minesRepo.persistMinesInitialIdempotent(
        gameResult.value,
      );
      this.logger.log(
        `[game-save] ${MINES_SAVE_INITIAL_JOB_NAME} ok jobId=${job.id} gameId=${data.gameId} inserted=${inserted} processDurationMs=${Date.now() - started}`,
      );
    } catch (err) {
      if (err instanceof UnrecoverableError) {
        this.logger.error(
          `[game-save] ${MINES_SAVE_INITIAL_JOB_NAME} unrecoverable jobId=${job.id} payload=${JSON.stringify(data)}`,
          err.stack,
        );
        throw err;
      }
      this.logJobError(MINES_SAVE_INITIAL_JOB_NAME, job, data, err);
      throw err;
    }
  }

  private logJobError(
    kind: string,
    job: Job,
    data: unknown,
    err: unknown,
  ): void {
    const stack = err instanceof Error ? err.stack : undefined;
    this.logger.error(
      `[game-save] ${kind} failed jobId=${job.id} payload=${JSON.stringify(data)}`,
      stack ?? err,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, err: Error): void {
    this.logger.error(
      `[game-save] worker event=failed jobId=${job?.id} name=${job?.name} err=${err.message}`,
      err.stack,
    );
  }
}
