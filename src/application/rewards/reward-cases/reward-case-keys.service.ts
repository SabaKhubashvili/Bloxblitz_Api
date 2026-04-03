import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import {
  BotTradeStatus,
  UserInventoryItemState,
  UserRewardKeySource,
} from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistance/prisma/prisma.service';
import { resolvePetValueForCaseItemVariants } from '../../../domain/game/case/services/case-item-pet-value';
import {
  RAKEBACK_MILESTONE_KEYS,
  REWARD_KEYS_PER_LEVEL_UP,
  REWARD_RAKEBACK_CASE_SLUG,
  rewardCaseSlugForLevel,
} from '../../../shared/config/reward-cases.config';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { RedisKeys } from '../../../infrastructure/cache/redis.keys';
import { DiceBalanceLedgerAdapter } from '../../../infrastructure/cache/adapters/dice-balance-ledger.adapter';

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

const petSelectForPool = {
  id: true,
  name: true,
  image: true,
  rarity: true,
  rvalue_nopotion: true,
  rvalue_ride: true,
  rvalue_fly: true,
  rvalue_flyride: true,
  nvalue_nopotion: true,
  nvalue_ride: true,
  nvalue_fly: true,
  nvalue_flyride: true,
  mvalue_nopotion: true,
  mvalue_ride: true,
  mvalue_fly: true,
  mvalue_flyride: true,
} as const;

type PoolRow = Prisma.RewardCaseItemGetPayload<{
  select: {
    id: true;
    petId: true;
    weight: true;
    sortOrder: true;
    variant: true;
    pet: { select: typeof petSelectForPool };
  };
}>;

function pickWeightedPool(items: PoolRow[]): PoolRow | null {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0 || items.length === 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight);
    if (r <= 0) return it;
  }
  return items[items.length - 1] ?? null;
}

export type RewardCasePoolItemDto = {
  id: string;
  petId: number;
  weight: number;
  sortOrder: number;
  variant: string[];
  value: number;
  pet: {
    id: number;
    name: string;
    image: string;
    rarity: string;
  };
};

export type XpMilestoneProgressDto = {
  /** XP required for each repeating key grant. null = feature disabled. */
  threshold: number | null;
  /** Keys already granted via XP milestones for this case. */
  keysGranted: number;
  /** How many more XP until the next key (0 when threshold is null). */
  xpToNextKey: number;
  /** Current XP modulo threshold — raw progress bar value. */
  xpProgress: number;
};

export type RewardCaseOpenRewardDto = {
  rewardCaseItemId: string;
  petId: number;
  name: string;
  image: string;
  rarity: string;
  variant: string[];
  value: number;
};

/** Most recent case open for this user (any case), from `RewardCaseOpen`. */
export type LastRewardCaseOpenDto = {
  slug: string;
  title: string;
  rewardCaseId: string;
  openedAt: string;
};

@Injectable()
export class RewardCaseKeysService {
  private readonly logger = new Logger(RewardCaseKeysService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ledger: DiceBalanceLedgerAdapter,
  ) {}

  async listDefinitions(): Promise<
    Array<{
      slug: string;
      position: number;
      imageUrl: string;
      title: string;
      isRakebackCase: boolean;
      xpMilestoneThreshold: number | null;
      xpMilestoneMaxKeysPerEvent: number;
      poolItems: RewardCasePoolItemDto[];
    }>
  > {
    const rows = await this.prisma.rewardCaseDefinition.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
      select: {
        slug: true,
        position: true,
        imageUrl: true,
        title: true,
        isRakebackCase: true,
        xpMilestoneThreshold: true,
        xpMilestoneMaxKeysPerEvent: true,
        poolItems: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            petId: true,
            weight: true,
            sortOrder: true,
            variant: true,
            pet: { select: { ...petSelectForPool } },
          },
        },
      },
    });

    return rows.map((r) => ({
      slug: r.slug,
      position: r.position,
      imageUrl: r.imageUrl,
      title: r.title,
      isRakebackCase: r.isRakebackCase,
      xpMilestoneThreshold: r.xpMilestoneThreshold,
      xpMilestoneMaxKeysPerEvent: r.xpMilestoneMaxKeysPerEvent,
      poolItems: r.poolItems.map((p) => {
        const variant = p.variant.map((v) => String(v));
        const pet = p.pet;
        const value = resolvePetValueForCaseItemVariants(pet, variant);
        return {
          id: p.id,
          petId: p.petId,
          weight: p.weight,
          sortOrder: p.sortOrder,
          variant,
          value,
          pet: {
            id: pet.id,
            name: pet.name,
            image: pet.image,
            rarity: pet.rarity,
          },
        };
      }),
    }));
  }

  async getKeyBalances(username: string): Promise<Record<string, number>> {
    const sums = await this.prisma.userKey.groupBy({
      by: ['rewardCaseId'],
      where: { userUsername: username },
      _sum: { quantity: true },
    });
    const ids = sums.map((s) => s.rewardCaseId);
    if (ids.length === 0) return {};
    const defs = await this.prisma.rewardCaseDefinition.findMany({
      where: { id: { in: ids } },
      select: { id: true, slug: true },
    });
    const idToSlug = new Map(defs.map((d) => [d.id, d.slug]));
    const out: Record<string, number> = {};
    for (const row of sums) {
      const slug = idToSlug.get(row.rewardCaseId);
      if (!slug) continue;
      out[slug] = row._sum.quantity ?? 0;
    }
    return out;
  }

  /**
   * Latest open across all reward cases (by `RewardCaseOpen.createdAt`),
   * for UI such as global cooldown / “last opened” next to key balances.
   */
  async getLastCaseOpenForUser(
    userUsername: string,
  ): Promise<LastRewardCaseOpenDto | null> {
    const row = await this.prisma.rewardCaseOpen.findFirst({
      where: { userUsername },
      orderBy: { createdAt: 'desc' },
      select: {
        rewardCaseId: true,
        createdAt: true,
        case: { select: { slug: true, title: true } },
      },
    });
    if (!row) return null;
    return {
      slug: row.case.slug,
      title: row.case.title,
      rewardCaseId: row.rewardCaseId,
      openedAt: row.createdAt.toISOString(),
    };
  }

  async grantKeysFromWager(
    userUsername: string,
    wagerCoins: number,
    referenceId?: string,
  ): Promise<void> {
    if (!Number.isFinite(wagerCoins) || wagerCoins <= 0) return;

    const defs = await this.prisma.rewardCaseDefinition.findMany({
      where: { receivesWagerKeys: true, isActive: true },
      select: {
        id: true,
        wagerCoinsPerKey: true,
        wagerKeysMaxPerEvent: true,
      },
    });
    if (defs.length === 0) {
      this.logger.warn(
        '[RewardKeys] no active reward case is configured to receive wager keys',
      );
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const def of defs) {
        const step = Math.max(1, def.wagerCoinsPerKey);
        const cap = Math.max(1, def.wagerKeysMaxPerEvent);
        const keys = Math.min(cap, Math.max(1, Math.floor(wagerCoins / step)));
        if (keys <= 0) continue;
        await tx.userKey.create({
          data: {
            id: randomUUID(),
            userUsername,
            rewardCaseId: def.id,
            quantity: keys,
            source: UserRewardKeySource.WAGER,
            referenceId: referenceId ?? null,
          },
        });
      }
    });
  }

  async grantKeysFromLevelProgress(
    userUsername: string,
    previousLevel: number,
    newLevel: number,
    referenceId?: string,
  ): Promise<void> {
    if (newLevel <= previousLevel) return;

    for (let level = previousLevel + 1; level <= newLevel; level++) {
      const slug = rewardCaseSlugForLevel(level);
      const def = await this.prisma.rewardCaseDefinition.findUnique({
        where: { slug },
        select: { id: true, levelUpKeysOverride: true, isActive: true },
      });
      if (def && def.isActive) {
        const q =
          def.levelUpKeysOverride != null && def.levelUpKeysOverride >= 0
            ? def.levelUpKeysOverride
            : REWARD_KEYS_PER_LEVEL_UP;
        if (q > 0) {
          await this.prisma.userKey.create({
            data: {
              id: randomUUID(),
              userUsername,
              rewardCaseId: def.id,
              quantity: q,
              source: UserRewardKeySource.LEVEL_UP,
              referenceId: referenceId ?? `level-${level}`,
            },
          });
        }
      }

      const milestoneKeys = RAKEBACK_MILESTONE_KEYS[level];
      if (milestoneKeys != null && milestoneKeys > 0) {
        const rake = await this.prisma.rewardCaseDefinition.findUnique({
          where: { slug: REWARD_RAKEBACK_CASE_SLUG },
          select: { id: true, isActive: true },
        });
        if (rake && rake.isActive) {
          await this.prisma.userKey.create({
            data: {
              id: randomUUID(),
              userUsername,
              rewardCaseId: rake.id,
              quantity: milestoneKeys,
              source: UserRewardKeySource.MILESTONE_RAKEBACK,
              referenceId: referenceId ?? `milestone-${level}`,
            },
          });
        }
      }
    }
  }

  /**
   * Awards keys for every active reward case whose `xpMilestoneThreshold` is
   * configured, based on the XP gained in the CURRENT event (delta).
   *
   * Formula per case:
   *   keysThisEvent = floor(xpGained / threshold)
   *   actualGrant   = maxPerEvent > 0
   *                     ? min(keysThisEvent, maxPerEvent)   // capped
   *                     : keysThisEvent                     // unlimited
   *
   * Each case is evaluated independently — XP is not a shared resource.
   * The progress table is updated for display only (total keys ever granted).
   */
  async grantKeysFromXpMilestone(
    userUsername: string,
    xpGained: number,
    referenceId?: string,
  ): Promise<void> {
    if (!Number.isFinite(xpGained) || xpGained <= 0) return;

    const defs = await this.prisma.rewardCaseDefinition.findMany({
      where: {
        isActive: true,
        xpMilestoneThreshold: { not: null, gt: 0 },
      },
      select: {
        id: true,
        xpMilestoneThreshold: true,
        xpMilestoneMaxKeysPerEvent: true,
      },
    });
    if (defs.length === 0) return;

    await this.prisma.$transaction(async (tx) => {
      for (const def of defs) {
        const threshold = def.xpMilestoneThreshold!;

        // How many threshold crossings occurred in this single XP event
        const keysThisEvent = Math.floor(xpGained / threshold);
        if (keysThisEvent <= 0) continue;

        // maxKeysPerEvent = 0 means unlimited; any positive value caps the grant.
        const maxPerEvent = def.xpMilestoneMaxKeysPerEvent;
        const actualGrant =
          maxPerEvent > 0
            ? Math.min(keysThisEvent, maxPerEvent)
            : keysThisEvent;

        await tx.userKey.create({
          data: {
            id: randomUUID(),
            userUsername,
            rewardCaseId: def.id,
            quantity: actualGrant,
            source: UserRewardKeySource.XP_MILESTONE,
            referenceId: referenceId ?? null,
          },
        });

        this.logger.debug(
          `[XpMilestone] user=${userUsername} case=${def.id} ` +
            `xpGained=${xpGained} threshold=${threshold} ` +
            `keysThisEvent=${keysThisEvent} maxPerEvent=${maxPerEvent} granted=${actualGrant}`,
        );

        // Update the lifetime counter for UI progress display only.
        await tx.rewardCaseMilestoneProgress.upsert({
          where: {
            userUsername_rewardCaseId: {
              userUsername,
              rewardCaseId: def.id,
            },
          },
          create: {
            id: randomUUID(),
            userUsername,
            rewardCaseId: def.id,
            keysGranted: actualGrant,
          },
          update: { keysGranted: { increment: actualGrant } },
        });
      }
    });
  }

  /** Reads the user's current cumulative XP directly from the User record. */
  async getUserTotalXp(userUsername: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { username: userUsername },
      select: { totalXP: true },
    });
    return user?.totalXP ?? 0;
  }

  /**
   * Returns per-case XP milestone progress for the authenticated user.
   * Only cases with `xpMilestoneThreshold` set are included.
   *
   * Because keys are awarded per-event (delta-based), `xpProgress` and
   * `xpToNextKey` reflect the user's position within the current threshold
   * cycle using their total XP — useful as a "how close to another key on
   * the next big bet" indicator.
   */
  async getXpMilestoneProgress(
    userUsername: string,
    totalXp: number,
  ): Promise<Record<string, XpMilestoneProgressDto>> {
    const defs = await this.prisma.rewardCaseDefinition.findMany({
      where: {
        isActive: true,
        xpMilestoneThreshold: { not: null, gt: 0 },
      },
      select: {
        slug: true,
        id: true,
        xpMilestoneThreshold: true,
        xpMilestoneMaxKeysPerEvent: true,
      },
    });
    if (defs.length === 0) return {};

    const progressRows = await this.prisma.rewardCaseMilestoneProgress.findMany(
      {
        where: {
          userUsername,
          rewardCaseId: { in: defs.map((d) => d.id) },
        },
        select: { rewardCaseId: true, keysGranted: true },
      },
    );
    const progressMap = new Map(
      progressRows.map((p) => [p.rewardCaseId, p.keysGranted]),
    );

    const result: Record<string, XpMilestoneProgressDto> = {};
    for (const def of defs) {
      const threshold = def.xpMilestoneThreshold!;
      const keysGranted = progressMap.get(def.id) ?? 0;
      // Show progress through the current threshold cycle (total XP mod threshold).
      const xpProgress = totalXp % threshold;
      result[def.slug] = {
        threshold,
        keysGranted,
        xpToNextKey: threshold - xpProgress,
        xpProgress,
      };
    }
    return result;
  }

  async openCase(
    userUsername: string,
    slug: string,
  ): Promise<{
    slug: string;
    title: string;
    rewards: RewardCaseOpenRewardDto[];
    keysSpent: number;
  }> {
    const def = await this.prisma.rewardCaseDefinition.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        isActive: true,
        poolItems: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            petId: true,
            weight: true,
            sortOrder: true,
            variant: true,
            pet: { select: { ...petSelectForPool } },
          },
        },
      },
    });

    if (!def) {
      throw new Error('REWARD_CASE_NOT_FOUND');
    }

    if (!def.isActive) {
      throw new Error('REWARD_CASE_INACTIVE');
    }

    if (def.poolItems.length === 0) {
      throw new Error('REWARD_CASE_EMPTY');
    }

    // ── Global 24-hour cooldown check (across all case types) ─────────────────
    try {
      const lastOpenMs = await this.redis.get<string>(
        RedisKeys.case.cooldown(userUsername),
      );
      if (lastOpenMs) {
        const openedAt = Number(lastOpenMs);
        const endsAt = openedAt + COOLDOWN_MS;
        if (endsAt > Date.now()) {
          throw new Error('CASE_GLOBAL_COOLDOWN');
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === 'CASE_GLOBAL_COOLDOWN') {
        throw err;
      }
      // Redis read failures are non-fatal; fall through to per-case cooldown
      this.logger.warn(
        `[RewardCases] global cooldown read failed for user=${userUsername}; continuing`,
        err,
      );
    }

    const outcome = await this.prisma.$transaction(async (tx) => {
      // DB source of truth when Redis is missing: any reward case open in the window
      // matches global cooldown (same as RedisKeys.case.cooldown).
      const latestRewardOpen = await tx.rewardCaseOpen.findFirst({
        where: { userUsername },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      if (
        latestRewardOpen &&
        Date.now() - latestRewardOpen.createdAt.getTime() < COOLDOWN_MS
      ) {
        throw new Error('CASE_GLOBAL_COOLDOWN');
      }

      const sumRow = await tx.userKey.aggregate({
        where: { userUsername, rewardCaseId: def.id },
        _sum: { quantity: true },
      });
      const balance = sumRow._sum.quantity ?? 0;
      if (balance < 1) {
        throw new Error('REWARD_CASE_INSUFFICIENT_KEYS');
      }

      const picked = pickWeightedPool(def.poolItems as PoolRow[]);
      if (!picked) {
        throw new Error('REWARD_CASE_ROLL_FAILED');
      }

      const pet = picked.pet;
      const variant = picked.variant.map((v) => String(v));
      const value = resolvePetValueForCaseItemVariants(pet, variant);
      const rewards: RewardCaseOpenRewardDto[] = [
        {
          rewardCaseItemId: picked.id,
          petId: pet.id,
          name: pet.name,
          image: pet.image,
          rarity: pet.rarity,
          variant,
          value,
        },
      ];

      await tx.userKey.create({
        data: {
          id: randomUUID(),
          userUsername,
          rewardCaseId: def.id,
          quantity: -1,
          source: UserRewardKeySource.CASE_OPEN_SPEND,
          referenceId: randomUUID(),
        },
      });

      await tx.rewardCaseOpen.create({
        data: {
          id: randomUUID(),
          userUsername,
          rewardCaseId: def.id,
          itemsReceived: rewards as unknown as Prisma.InputJsonValue,
        },
      });

      const bot = await tx.ampBot.findFirst({
        where: { active: true, banned: false },
        orderBy: { id: 'asc' },
        select: { id: true },
      });

      if (bot) {
        await tx.userInventoryAmp.create({
          data: {
            userUsername,
            petId: pet.id,
            state: UserInventoryItemState.IDLE,
            petInGameId: randomUUID(),
            value,
            petVariant: picked.variant,
            owner_bot_id: bot.id,
            botTradeStatus: BotTradeStatus.NONE,
          },
        });
      } else {
        this.logger.warn(
          `[RewardCases] no active AmpBot; open recorded for ${userUsername} but inventory row skipped`,
        );
      }

      return {
        slug: def.slug,
        title: def.title,
        rewards,
        keysSpent: 1,
      };
    });

    // ── Set global 24-hour cooldown ───────────────────────────────────────────
    try {
      await this.redis.set(
        RedisKeys.case.cooldown(userUsername),
        String(Date.now()),
        86400,
      );
    } catch (err) {
      this.logger.warn(
        `[RewardCases] global cooldown set failed for user=${userUsername}`,
        err,
      );
    }

    // ── Credit won item value to user balance ─────────────────────────────────
    const wonValue = outcome.rewards.reduce((sum, r) => sum + r.value, 0);
    if (wonValue > 0) {
      try {
        await this.ledger.settlePayout({ username: userUsername, profit: wonValue });
        this.logger.log(
          `[RewardCases] balance credited user=${userUsername} amount=+${wonValue}`,
        );
      } catch (err) {
        this.logger.error(
          `[RewardCases] balance credit FAILED user=${userUsername} amount=${wonValue} — manual reconciliation required`,
          err,
        );
      }
    }

    return outcome;
  }
}
