import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { UserRewardKeySource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IncrementUserBalanceUseCase } from '../../../../application/balance/use-cases/increment-user-balance.use-case';
import type {
  ExecuteOpenCommand,
  ExecuteOpenResult,
  IRewardCaseOpenRepository,
} from '../../../../application/rewards/reward-cases/ports/reward-case-open.repository.port';

@Injectable()
export class PrismaRewardCaseOpenRepository implements IRewardCaseOpenRepository {
  private readonly logger = new Logger(PrismaRewardCaseOpenRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly incrementBalance: IncrementUserBalanceUseCase,
  ) {}

  /**
   * Persists the case open in a Prisma transaction, then credits
   * `reward.value` via {@link IncrementUserBalanceUseCase} (Redis — runs
   * after the DB commit).
   */
  async executeOpen(cmd: ExecuteOpenCommand): Promise<ExecuteOpenResult> {
    const { userUsername, caseSlug, reward, cooldownMs } = cmd;

    const result = await this.prisma.$transaction(async (tx) => {
      // ── 1. DB cooldown fallback ─────────────────────────────────────────────
      const latestOpen = await tx.rewardCaseOpen.findFirst({
        where: { userUsername },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (
        latestOpen &&
        Date.now() - latestOpen.createdAt.getTime() < cooldownMs
      ) {
        throw new Error('CASE_GLOBAL_COOLDOWN');
      }

      // ── 2. Resolve case ID from slug ────────────────────────────────────────
      const caseDef = await tx.rewardCaseDefinition.findUnique({
        where: { slug: caseSlug },
        select: { id: true, slug: true, title: true },
      });
      if (!caseDef) {
        throw new Error('REWARD_CASE_NOT_FOUND');
      }

      // ── 3. Verify key balance ───────────────────────────────────────────────
      const sumRow = await tx.userKey.aggregate({
        where: { userUsername, rewardCaseId: caseDef.id },
        _sum: { quantity: true },
      });
      const keyBalance = sumRow._sum.quantity ?? 0;
      if (keyBalance < 1) {
        throw new Error('REWARD_CASE_INSUFFICIENT_KEYS');
      }

      // ── 4. Deduct one key ───────────────────────────────────────────────────
      await tx.userKey.create({
        data: {
          id: randomUUID(),
          userUsername,
          rewardCaseId: caseDef.id,
          quantity: -1,
          source: UserRewardKeySource.CASE_OPEN_SPEND,
          referenceId: randomUUID(),
        },
      });

      // ── 5. Record the open ─────────────────────────────────────────────────
      await tx.rewardCaseOpen.create({
        data: {
          id: randomUUID(),
          userUsername,
          rewardCaseId: caseDef.id,
          itemsReceived: [reward] as unknown as Prisma.InputJsonValue,
        },
      });

      return {
        caseSlug: caseDef.slug,
        caseTitle: caseDef.title,
      };
    });

    const wonValue = reward.value;
    if (wonValue > 0) {
      try {
        await this.incrementBalance.execute(userUsername, wonValue);
      } catch (err) {
        this.logger.error(
          `[RewardCaseOpen] CRITICAL: balance credit failed after committed open ` +
            `user=${userUsername} amount=+${wonValue} — manual reconciliation required`,
          err,
        );
      }
    }

    return result;
  }
}
