import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type { ICaseRepository } from '../../../../domain/game/case/ports/case.repository.port';
import { CaseFairnessDomainService } from '../../../../domain/game/case/services/case-fairness.domain-service';
import { CASE_REPOSITORY } from '../tokens/case.tokens';
import {
  buildCaseVerifyPoolItems,
  type CaseVerifyPoolItemDto,
} from '../services/case-verify-pool.mapper';

export interface VerifyCaseOpenCommand {
  slug: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  expectedWonCaseItemId?: string;
  expectedNormalizedRoll?: number;
}

export interface VerifyCaseOpenOutputDto {
  verified: boolean;
  caseId: string;
  caseName: string;
  slug: string;
  normalizedRoll: number;
  wonCaseItemId: string;
  poolItems: CaseVerifyPoolItemDto[];
  wonItem: CaseVerifyPoolItemDto;
  itemMatchesExpected?: boolean;
  rollMatchesExpected?: boolean;
  message: string;
}

type VerifyCaseOpenFacts = Pick<
  VerifyCaseOpenOutputDto,
  | 'caseId'
  | 'caseName'
  | 'slug'
  | 'normalizedRoll'
  | 'wonCaseItemId'
  | 'poolItems'
  | 'wonItem'
>;

@Injectable()
export class VerifyCaseOpenUseCase {
  constructor(
    @Inject(CASE_REPOSITORY) private readonly caseRepo: ICaseRepository,
    private readonly fairness: CaseFairnessDomainService,
  ) {}

  async execute(cmd: VerifyCaseOpenCommand): Promise<VerifyCaseOpenOutputDto> {
    const slug = cmd.slug?.trim();
    const serverSeed = cmd.serverSeed?.trim();
    const clientSeed = cmd.clientSeed?.trim();

    if (!slug || !serverSeed || !clientSeed) {
      throw new BadRequestException(
        'slug, serverSeed, and clientSeed are required',
      );
    }
    if (!Number.isInteger(cmd.nonce) || cmd.nonce < 0) {
      throw new BadRequestException('nonce must be a non-negative integer');
    }

    const detail = await this.caseRepo.findBySlugWithItems(slug);
    if (!detail) {
      throw new BadRequestException(`Case not found: ${slug}`);
    }

    const pool = detail.items.filter((i) => i.weight > 0);
    if (pool.length === 0) {
      throw new BadRequestException('Case has no weighted items');
    }

    const normalizedRoll = this.fairness.generateNormalizedRoll(
      serverSeed,
      clientSeed,
      cmd.nonce,
    );

    let wonCaseItemId: string;
    try {
      wonCaseItemId = this.fairness.selectWeightedItemId(pool, normalizedRoll);
    } catch {
      throw new BadRequestException('Weighted selection failed');
    }

    const poolItems = buildCaseVerifyPoolItems(pool);
    const wonItem = poolItems.find((p) => p.id === wonCaseItemId);
    if (!wonItem) {
      throw new BadRequestException('Resolved item missing from case pool');
    }

    const facts: VerifyCaseOpenFacts = {
      caseId: detail.id,
      caseName: detail.name,
      slug: detail.slug,
      normalizedRoll,
      wonCaseItemId,
      poolItems,
      wonItem,
    };

    if (
      cmd.expectedWonCaseItemId != null &&
      cmd.expectedWonCaseItemId.trim() !== '' &&
      cmd.expectedWonCaseItemId !== wonCaseItemId
    ) {
      const out: VerifyCaseOpenOutputDto = {
        verified: false,
        ...facts,
        itemMatchesExpected: false,
        message: `Recomputed item ${wonCaseItemId} does not match expected ${cmd.expectedWonCaseItemId}.`,
      };
      return out;
    }

    if (
      cmd.expectedNormalizedRoll != null &&
      Number.isFinite(cmd.expectedNormalizedRoll) &&
      Math.abs(cmd.expectedNormalizedRoll - normalizedRoll) > 1e-12
    ) {
      const out: VerifyCaseOpenOutputDto = {
        verified: false,
        ...facts,
        rollMatchesExpected: false,
        message: `Recomputed normalized roll ${normalizedRoll} does not match expected ${cmd.expectedNormalizedRoll}.`,
      };
      return out;
    }

    const out: VerifyCaseOpenOutputDto = {
      verified: true,
      ...facts,
      itemMatchesExpected:
        cmd.expectedWonCaseItemId != null
          ? cmd.expectedWonCaseItemId === wonCaseItemId
          : undefined,
      rollMatchesExpected:
        cmd.expectedNormalizedRoll != null
          ? Math.abs(cmd.expectedNormalizedRoll - normalizedRoll) <= 1e-12
          : undefined,
      message: 'Case open verified.',
    };
    return out;
  }
}
