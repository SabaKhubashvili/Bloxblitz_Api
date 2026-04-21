import { Injectable, Logger } from '@nestjs/common';
import type { Result } from '../../../../domain/shared/types/result.type';
import type { LevelingError } from '../../../../domain/leveling/errors/leveling.errors';
import type { LevelProgressOutputDto } from '../dto/level-progress.output-dto';
import type { GrantWagerXpCommand } from '../dto/grant-wager-xp.command';
import { AddExperienceUseCase } from './add-experience.use-case';

/**
 * Centralizes wager-based XP persistence: delegates to {@link AddExperienceUseCase},
 * standardizes logging, and normalizes errors (no unhandled rejections).
 * Does not compute `xpAmount` — each game use case supplies the value.
 */
@Injectable()
export class GrantWagerXpUseCase {
  private readonly logger = new Logger(GrantWagerXpUseCase.name);

  constructor(private readonly addExperienceUseCase: AddExperienceUseCase) {}

  /**
   * @returns The inner leveling result, or `null` only when an unexpected error was caught.
   */
  async execute(
    cmd: GrantWagerXpCommand,
  ): Promise<Result<LevelProgressOutputDto, LevelingError> | null> {
    const logFields = {
      username: cmd.username,
      xpAmount: cmd.xpAmount,
      wager: cmd.wager,
      gameId: cmd.gameId,
      source: cmd.source,
      ...(cmd.grantContext != null ? { grantContext: cmd.grantContext } : {}),
    };

    const amount = Math.max(0, cmd.xpAmount);

    try {
      const result = await this.addExperienceUseCase.execute({
        username: cmd.username,
        amount,
        wagerCoins: cmd.wager,
        source: cmd.source,
        referenceId: cmd.gameId,
      });

      if (!result.ok) {
        this.logger.warn(
          {
            event: 'xp.wager.grant.business_failure',
            ...logFields,
            errorMessage: result.error.message,
          },
          'Wager XP grant failed (business)',
        );
      } else {
        this.logger.log(
          {
            event: 'xp.wager.grant.success',
            ...logFields,
            currentLevel: result.value.currentLevel,
            tierName: result.value.tierName,
          },
          'Wager XP granted',
        );
      }

      return result;
    } catch (err) {
      this.logger.error(
        {
          event: 'xp.wager.grant.unexpected_error',
          ...logFields,
        },
        err,
      );
      return null;
    }
  }
}
