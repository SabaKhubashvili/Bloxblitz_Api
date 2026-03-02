import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface.js';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type.js';
import type { IMinesGameRepository } from '../../../../domain/game/mines/ports/mines-game.repository.port.js';
import type { MinesGameOutputDto } from '../dto/mines-game.output-dto.js';
import { MINES_GAME_REPOSITORY } from '../tokens/mines.tokens.js';
import {
  GameNotFoundError,
  MinesError,
} from '../../../../domain/game/mines/errors/mines.errors.js';
import { MinesGameMapper } from '../mappers/mines-game.mapper.js';

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
