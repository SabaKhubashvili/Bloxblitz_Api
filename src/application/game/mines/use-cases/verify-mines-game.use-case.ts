import { Injectable } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import { MinesFairnessDomainService } from '../../../../domain/game/mines/services/mines-fairness.domain-service';
import type { VerifyMinesGameCommand } from '../dto/verify-mines-game.command';
import type { VerifyMinesGameOutputDto } from '../dto/verify-mines-game.output-dto';
import {
  InvalidMineCountError,
  MinesError,
} from '../../../../domain/game/mines/errors/mines.errors';

@Injectable()
export class VerifyMinesGameUseCase implements IUseCase<
  VerifyMinesGameCommand,
  Result<VerifyMinesGameOutputDto, MinesError>
> {
  constructor(private readonly fairnessService: MinesFairnessDomainService) {}

  async execute(
    cmd: VerifyMinesGameCommand,
  ): Promise<Result<VerifyMinesGameOutputDto, MinesError>> {
    if (cmd.mines < 1 || cmd.mines >= cmd.gridSize) {
      return Err(new InvalidMineCountError());
    }

    const minePositions = this.fairnessService.verifyGame(
      cmd.serverSeed,
      cmd.clientSeed,
      cmd.nonce,
      cmd.gridSize,
      cmd.mines,
    );

    return Ok({
      verified: true,
      message: 'Game successfully verified!',
      data: {
        minePositions,
        gridSize: cmd.gridSize,
        mines: cmd.mines,
        nonce: cmd.nonce,
      },
    });
  }
}
