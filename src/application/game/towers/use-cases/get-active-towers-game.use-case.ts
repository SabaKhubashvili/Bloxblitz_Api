import { Injectable } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok } from '../../../../domain/shared/types/result.type';
import { TowersActiveGameService } from '../../../../infrastructure/game/towers/towers-active-game.service';
import { toTowersGamePublicDto } from '../mappers/towers-public.mapper';
import type { TowersActiveGameResponseDto } from '../dto/towers-game-public.dto';
import { TOWERS_MULTIPLIER_LADDERS_PREVIEW } from '../../../../domain/game/towers/towers-multiplier.service';

@Injectable()
export class GetActiveTowersGameUseCase
  implements
    IUseCase<
      { username?: string },
      Result<TowersActiveGameResponseDto, never>
    >
{
  constructor(private readonly activeGame: TowersActiveGameService) {}

  async execute(cmd: {
    username?: string;
  }): Promise<Result<TowersActiveGameResponseDto, never>> {
    if (!cmd.username) {
      return Ok({
        game: null,
        multiplierLadders: TOWERS_MULTIPLIER_LADDERS_PREVIEW,
      });
    }

    const game = await this.activeGame.loadActive(cmd.username.toLowerCase());
    return Ok({
      game: game ? toTowersGamePublicDto(game) : null,
      multiplierLadders: TOWERS_MULTIPLIER_LADDERS_PREVIEW,
    });
  }
}
