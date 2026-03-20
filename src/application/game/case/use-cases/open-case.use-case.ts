import { Injectable, Inject, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { IUseCase } from '../../../shared/use-case.interface';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type {
  ICaseRepository,
  CaseDetailRecord,
  CaseOpenWrite,
} from '../../../../domain/game/case/ports/case.repository.port';
import type { ICaseDetailCachePort } from '../../../../domain/game/case/ports/case-detail-cache.port';
import type { IUserSeedRepository } from '../../../../domain/user/ports/user-seed.repository.port';
import type { IDiceBalanceLedgerPort } from '../../../../domain/game/dice/ports/dice-balance-ledger.port';
import { CaseFairnessDomainService } from '../../../../domain/game/case/services/case-fairness.domain-service';
import { sha256HashServerSeed } from '../../../../domain/shared/provably-fair-hash';
import {
  CaseNotFoundError,
  CaseInactiveError,
  CaseEmptyPoolError,
  CaseInsufficientBalanceError,
  CaseUserSeedNotFoundError,
  CaseInvalidQuantityError,
  CasePersistenceError,
  type CaseError,
} from '../../../../domain/game/case/errors/case.errors';
import { CASE_DETAIL_CACHE, CASE_REPOSITORY } from '../tokens/case.tokens';
import { CASE_PUBLIC_READ_CACHE_TTL_SECONDS } from '../case-cache.constants';
import { USER_SEED_REPOSITORY } from '../../dice/tokens/dice.tokens';
import { DICE_BALANCE_LEDGER } from '../../dice/tokens/dice.tokens';
import type { OpenCaseCommand } from '../dto/open-case.command';
import type { OpenCaseOutputDto, CaseOpenSingleOutputDto } from '../dto/case.output-dto';

const MIN_QTY = 1;
const MAX_QTY = 5;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function msSince(start: number): number {
  return Math.round((performance.now() - start) * 100) / 100;
}

@Injectable()
export class OpenCaseUseCase
  implements IUseCase<OpenCaseCommand, Result<OpenCaseOutputDto, CaseError>>
{
  private readonly logger = new Logger(OpenCaseUseCase.name);

  constructor(
    @Inject(CASE_REPOSITORY)
    private readonly caseRepo: ICaseRepository,
    @Inject(CASE_DETAIL_CACHE)
    private readonly detailCache: ICaseDetailCachePort,
    @Inject(USER_SEED_REPOSITORY)
    private readonly seedRepo: IUserSeedRepository,
    @Inject(DICE_BALANCE_LEDGER)
    private readonly ledger: IDiceBalanceLedgerPort,
    private readonly fairness: CaseFairnessDomainService,
  ) {}

  async execute(cmd: OpenCaseCommand): Promise<Result<OpenCaseOutputDto, CaseError>> {
    if (
      !Number.isInteger(cmd.quantity) ||
      cmd.quantity < MIN_QTY ||
      cmd.quantity > MAX_QTY
    ) {
      return Err(new CaseInvalidQuantityError());
    }

    const tExec = performance.now();

    let detailCacheMs = 0;
    let detailDbMs = 0;
    let detailFromCache = false;

    let detail: CaseDetailRecord | null = null;
    const tCache = performance.now();
    try {
      detail = await this.detailCache.get(cmd.slug);
    } catch (err) {
      this.logger.warn(
        `[Cases] open: detail cache read failed slug=${cmd.slug}`,
        err,
      );
    }
    detailCacheMs = msSince(tCache);

    if (!detail) {
      const tDb = performance.now();
      try {
        detail = await this.caseRepo.findBySlugWithItems(cmd.slug);
      } catch (err) {
        this.logger.error(`[Cases] open findBySlug failed slug=${cmd.slug}`, err);
        return Err(new CasePersistenceError());
      }
      detailDbMs = msSince(tDb);
      if (detail) {
        void this.detailCache
          .set(cmd.slug, detail, CASE_PUBLIC_READ_CACHE_TTL_SECONDS)
          .catch((e) =>
            this.logger.warn(
              `[Cases] open: detail cache write failed slug=${cmd.slug}`,
              e,
            ),
          );
      }
    } else {
      detailFromCache = true;
    }

    if (!detail) return Err(new CaseNotFoundError(cmd.slug));
    if (!detail.isActive) return Err(new CaseInactiveError(cmd.slug));

    const pool = detail.items.filter((i) => i.weight > 0);
    if (pool.length === 0) return Err(new CaseEmptyPoolError());

    const tSeed = performance.now();
    const seed = await this.seedRepo.findByusername(cmd.username);
    const seedMs = msSince(tSeed);
    if (!seed) return Err(new CaseUserSeedNotFoundError());

    const price = detail.price;
    const opens: CaseOpenSingleOutputDto[] = [];
    const writes: CaseOpenWrite[] = [];

    let accPlaceBetMs = 0;
    let accSettleMs = 0;
    const tLoop = performance.now();

    for (let i = 0; i < cmd.quantity; i++) {
      const tBet = performance.now();
      const bet = await this.ledger.placeBet({
        username: cmd.username,
        betAmount: price,
      });
      accPlaceBetMs += msSince(tBet);
      if (!bet.success) {
        this.logger.warn(
          `[Cases] open perf (insufficient balance) slug=${cmd.slug} user=${cmd.username} qty=${cmd.quantity} iter=${i} total=${msSince(tExec)}ms detailCache=${detailCacheMs}ms detailDb=${detailDbMs}ms cacheHit=${detailFromCache} seed=${seedMs}ms loopSoFar=${msSince(tLoop)}ms placeBetSum=${accPlaceBetMs}ms settleSum=${accSettleMs}ms`,
        );
        return Err(new CaseInsufficientBalanceError());
      }

      // `placeBet` atomically deducts the case price and INCRs Redis `user:nonce:{user}`.
      const nonce = bet.nonce!;
      const normalizedRoll = this.fairness.generateNormalizedRoll(
        seed.serverSeed,
        seed.clientSeed,
        nonce,
      );

      let wonCaseItemId: string;
      try {
        wonCaseItemId = this.fairness.selectWeightedItemId(pool, normalizedRoll);
      } catch {
        return Err(new CaseEmptyPoolError());
      }

      const won = pool.find((p) => p.id === wonCaseItemId) ?? pool[0]!;
      const wonPetValue = roundMoney(won.pet.value);

      if (wonPetValue > 0) {
        const tSettle = performance.now();
        await this.ledger.settlePayout({
          username: cmd.username,
          profit: wonPetValue,
        });
        accSettleMs += msSince(tSettle);
      }

      void this.seedRepo
        .incrementTotalGamesPlayed(cmd.username, 1)
        .catch((e) =>
          this.logger.warn(
            `[Cases] userSeed totalGamesPlayed increment failed user=${cmd.username}`,
            e,
          ),
        );

      const openId = randomUUID();
      const gameHistoryId = randomUUID();
      const serverSeedHash = sha256HashServerSeed(seed.serverSeed);

      writes.push({
        id: openId,
        gameHistoryId,
        username: cmd.username,
        caseId: detail.id,
        wonCaseItemId,
        openBatchIndex: i,
        pricePaid: price,
        wonPetValue,
        clientSeed: seed.clientSeed,
        serverSeedHash,
        nonce,
        normalizedRoll,
      });

      opens.push({
        openId,
        gameHistoryId,
        openBatchIndex: i,
        wonCaseItemId,
        pricePaid: price,
        normalizedRoll,
        clientSeed: seed.clientSeed,
        serverSeedHash,
        nonce,
        pet: {
          id: won.pet.id,
          name: won.pet.name,
          image: won.pet.image,
          rarity: won.pet.rarity,
          value: wonPetValue,
        },
      });
    }

    const loopMs = msSince(tLoop);

    const responseMs = msSince(tExec);
    this.logger.log(
      `[Cases] opened qty=${cmd.quantity} user=${cmd.username} slug=${cmd.slug} | perf response=${responseMs}ms detailCache=${detailCacheMs}ms detailDb=${detailDbMs}ms cacheHit=${detailFromCache} seed=${seedMs}ms loop=${loopMs}ms placeBetSum=${accPlaceBetMs}ms settleSum=${accSettleMs}ms saveOpens=deferred`,
    );

    const repo = this.caseRepo;
    const logger = this.logger;
    const { username, slug } = cmd;
    setImmediate(() => {
      const tSave = performance.now();
      void repo
        .saveOpens(writes)
        .then(() => {
          logger.log(
            `[Cases] saveOpens async ok user=${username} slug=${slug} opens=${writes.length} ms=${msSince(tSave)}`,
          );
        })
        .catch((err: unknown) => {
          logger.error(
            `[Cases] saveOpens async FAILED user=${username} slug=${slug} opens=${writes.length} ms=${msSince(tSave)} — balance already moved; reconcile manually`,
            err,
          );
        });
    });

    return Ok({
      case: { id: detail.id, slug: detail.slug, name: detail.name },
      opens,
    });
  }
}
