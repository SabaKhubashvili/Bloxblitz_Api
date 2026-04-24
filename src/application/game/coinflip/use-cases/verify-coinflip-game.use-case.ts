import { BadRequestException, Injectable } from '@nestjs/common';
import { CoinflipFairnessDomainService } from '../../../../domain/game/coinflip/coinflip-fairness.domain-service';

export interface VerifyCoinflipGameCommand {
  serverSeed: string;
  eosBlockId: string;
  nonce: string;
  /** If provided, must equal SHA-256(serverSeed) hex. */
  publicServerSeed?: string;
  /** If provided, must match recomputed float within epsilon. */
  expectedRandomValue?: number;
}

export interface VerifyCoinflipGameOutputDto {
  isValid: boolean;
  recomputedHash: string;
  recomputedValue: number;
  headsOrTails: 'H' | 'T';
  commitmentDigest: string;
  publicSeedMatches?: boolean;
  randomValueMatchesExpected?: boolean;
  message: string;
}

@Injectable()
export class VerifyCoinflipGameUseCase {
  constructor(private readonly fairness: CoinflipFairnessDomainService) {}

  execute(cmd: VerifyCoinflipGameCommand): VerifyCoinflipGameOutputDto {
    const serverSeed = cmd.serverSeed?.trim();
    const eosBlockId = cmd.eosBlockId?.trim();
    const nonce = cmd.nonce?.trim();

    if (!serverSeed || !eosBlockId || !nonce) {
      throw new BadRequestException(
        'serverSeed, eosBlockId, and nonce are required',
      );
    }

    const recomputedHash = this.fairness.computeOutcomeHash(
      serverSeed,
      nonce,
      eosBlockId,
    );
    const recomputedValue = this.fairness.hashToFloat(recomputedHash);
    const commitmentDigest = this.fairness.commitmentSha256(serverSeed);
    const headsOrTails: 'H' | 'T' = recomputedValue < 0.5 ? 'H' : 'T';

    let publicSeedMatches: boolean | undefined;
    if (cmd.publicServerSeed != null && cmd.publicServerSeed.trim() !== '') {
      const want = cmd.publicServerSeed.trim().toLowerCase();
      publicSeedMatches = want === commitmentDigest.toLowerCase();
      if (!publicSeedMatches) {
        return {
          isValid: false,
          recomputedHash,
          recomputedValue,
          headsOrTails,
          commitmentDigest,
          publicSeedMatches: false,
          message:
            'publicServerSeed does not match SHA-256(serverSeed). Check the revealed seed.',
        };
      }
    }

    let randomValueMatchesExpected: boolean | undefined;
    if (
      cmd.expectedRandomValue != null &&
      Number.isFinite(cmd.expectedRandomValue)
    ) {
      randomValueMatchesExpected =
        Math.abs(cmd.expectedRandomValue - recomputedValue) < 1e-9;
      if (!randomValueMatchesExpected) {
        return {
          isValid: false,
          recomputedHash,
          recomputedValue,
          headsOrTails,
          commitmentDigest,
          publicSeedMatches,
          randomValueMatchesExpected: false,
          message: `Recomputed random value ${recomputedValue} does not match expected ${cmd.expectedRandomValue}.`,
        };
      }
    }

    return {
      isValid: true,
      recomputedHash,
      recomputedValue,
      headsOrTails,
      commitmentDigest,
      publicSeedMatches,
      randomValueMatchesExpected,
      message: 'Coinflip outcome verified.',
    };
  }
}
