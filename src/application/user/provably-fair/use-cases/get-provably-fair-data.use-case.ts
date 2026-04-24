import { Injectable, Inject } from '@nestjs/common';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { IProvablyFairDbPort } from '../ports/provably-fair-db.port';
import { ProvablyFairNotFoundError } from '../../../../domain/user/errors/provably-fair.errors';
import { PROVABLY_FAIR_DB_PORT } from '../tokens/provably-fair.tokens';

export interface GetProvablyFairDataCommand {
  username: string;
}

export interface GetProvablyFairDataOutputDto {
  clientSeed: string;
  serverSeedHash: string;
  nextServerSeedHash: string;
  totalGamesPlayed: number;
}

@Injectable()
export class GetProvablyFairDataUseCase implements IUseCase<
  GetProvablyFairDataCommand,
  Result<GetProvablyFairDataOutputDto, ProvablyFairNotFoundError>
> {
  constructor(
    @Inject(PROVABLY_FAIR_DB_PORT)
    private readonly provablyFairDb: IProvablyFairDbPort,
  ) {}

  async execute(
    cmd: GetProvablyFairDataCommand,
  ): Promise<Result<GetProvablyFairDataOutputDto, ProvablyFairNotFoundError>> {
    const data = await this.provablyFairDb.getProvablyFairData(cmd.username);

    if (!data) {
      return Err(new ProvablyFairNotFoundError(cmd.username));
    }

    return Ok({
      clientSeed: data.clientSeed,
      serverSeedHash: data.serverSeedHash,
      nextServerSeedHash: data.nextServerSeedHash,
      totalGamesPlayed: data.totalGamesPlayed,
    });
  }
}
