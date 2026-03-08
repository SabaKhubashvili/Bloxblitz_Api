import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IMinesGameRepository } from '../../../../domain/game/mines/ports/mines-game.repository.port';
import type { MinesGameOutputDto } from '../dto/mines-game.output-dto';
import { MINES_GAME_REPOSITORY } from '../tokens/mines.tokens';
import {
  GameNotFoundError,
  MinesError,
} from '../../../../domain/game/mines/errors/mines.errors';
import { MinesGameMapper } from '../mappers/mines-game.mapper';

export interface GetActiveMinesGameQuery {
  username: string;
}

@Injectable()
export class GetActiveMinesGameUseCase
  implements IUseCase<GetActiveMinesGameQuery, Result<MinesGameOutputDto, MinesError>>
{
  constructor(
    @Inject(MINES_GAME_REPOSITORY) private readonly minesRepo: IMinesGameRepository,
  ) {}

  async execute(
    query: GetActiveMinesGameQuery,
  ): Promise<Result<MinesGameOutputDto, MinesError>> {
    const game = await this.minesRepo.findActiveByusername(query.username);
    if (!game) return Err(new GameNotFoundError());

    return Ok(MinesGameMapper.toOutputDto(game));
  }
}
