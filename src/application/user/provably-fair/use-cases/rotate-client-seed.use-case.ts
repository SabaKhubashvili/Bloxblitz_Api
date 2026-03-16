import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IProvablyFairDbPort } from '../ports/provably-fair-db.port';
import { RotateClientSeedFailedError } from '../../../../domain/user/errors/provably-fair.errors';
import { PROVABLY_FAIR_DB_PORT } from '../tokens/provably-fair.tokens';

export interface RotateClientSeedCommand {
  username: string;
  clientSeed?: string;
}

export interface RotateClientSeedOutputDto {
  clientSeed: string | null;
  nextServerSeedHash: string | null;
  serverSeedHash: string | null;
  totalGamesPlayed: number;

  activeGames?: string[];
}

@Injectable()
export class RotateClientSeedUseCase implements IUseCase<
  RotateClientSeedCommand,
  Result<RotateClientSeedOutputDto, RotateClientSeedFailedError>
> {
  constructor(
    @Inject(PROVABLY_FAIR_DB_PORT)
    private readonly provablyFairDb: IProvablyFairDbPort,
  ) {}

  async execute(
    cmd: RotateClientSeedCommand,
  ): Promise<Result<RotateClientSeedOutputDto, RotateClientSeedFailedError>> {
    const result = await this.provablyFairDb.rotateClientSeed(
      cmd.username,
      cmd.clientSeed,
    );

    if (!result) {
      return Err(
        new RotateClientSeedFailedError('Failed to rotate client seed'),
      );
    }

    return Ok({
      clientSeed: result.clientSeed,
      nextServerSeedHash: result.nextServerSeedHash,
      serverSeedHash: result.serverSeedHash,
      totalGamesPlayed: result.totalGamesPlayed,
      activeGames: result.activeGames,
    });
  }
}
