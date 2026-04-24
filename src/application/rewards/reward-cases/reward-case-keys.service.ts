import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { UserRewardKeySource } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/persistance/prisma/prisma.service';
import { resolvePetValueForCaseItemVariants } from '../../../domain/game/case/services/case-item-pet-value';
import {
  RAKEBACK_MILESTONE_KEYS,
  REWARD_KEYS_PER_LEVEL_UP,
  REWARD_RAKEBACK_CASE_SLUG,
  rewardCaseSlugForLevel,
} from '../../../shared/config/reward-cases.config';
import type { IRewardCasesCachePort } from './ports/reward-cases-cache.port';
import { REWARD_CASES_CACHE_PORT } from './tokens/reward-cases.tokens';
import {
  REWARD_CASES_DEFINITIONS_TTL_SECONDS,
  REWARD_CASES_USER_STATE_TTL_SECONDS,
  REWARD_CASES_DEFINITIONS_LOCK_TTL_MS,
} from './reward-cases-cache.constants';

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

export type RewardCaseDefinitionDto = {
  slug: string;
  position: number;
  imageUrl: string;
  title: string;
  isRakebackCase: boolean;
  requiredLevel: number;
  xpMilestoneThreshold: number | null;
  xpMilestoneMaxKeysPerEvent: number;
  poolItems: RewardCasePoolItemDto[];
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
    @Inject(REWARD_CASES_CACHE_PORT)
    private readonly cache: IRewardCasesCachePort,
  ) {}

  // ── Definitions (shared, cached) ───────────────────────────────────────────

  async listDefinitions(): Promise<RewardCaseDefinitionDto[]> {
    // 1. Try cache first
    try {
      const cached = await this.cache.getDefinitions();
      if (cached !== null) {
        this.logger.debug('[RewardCases] listDefinitions: cache hit');
        return cached;
      }
    } catch (err) {
      this.logger.warn('[RewardCases] listDefinitions: cache read error', err);
    }

    this.logger.debug(
      '[RewardCases] listDefinitions: cache miss — fetching DB',
    );

    // 2. Try to acquire the populate-lock to prevent stampede.
    //    If the lock is not available another request is already populating —
    //    we still fetch from DB but skip the cache write.
    let lockAcquired = false;
    try {
      lockAcquired = await this.cache.acquireDefinitionsLock(
        REWARD_CASES_DEFINITIONS_LOCK_TTL_MS,
      );
    } catch {
      // Lock errors are non-fatal; proceed without a lock.
    }

    const result = await this._fetchDefinitionsFromDb();

    if (lockAcquired) {
      try {
        await this.cache.setDefinitions(
          result,
          REWARD_CASES_DEFINITIONS_TTL_SECONDS,
        );
      } catch (err) {
        this.logger.warn(
          '[RewardCases] listDefinitions: cache write error',
          err,
        );
      } finally {
        await this.cache.releaseDefinitionsLock();
      }
    }

    return result;
  }

  /** Raw DB fetch — extracted so it can be called without cache logic. */
  private async _fetchDefinitionsFromDb(): Promise<RewardCaseDefinitionDto[]> {
    const rows = await this.prisma.rewardCaseDefinition.findMany({
      where: { isActive: true },
      orderBy: { position: 'asc' },
      select: {
        slug: true,
        position: true,
        imageUrl: true,
        title: true,
        isRakebackCase: true,
        requiredLevel: true,
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
      requiredLevel: r.requiredLevel,
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

  // ── Per-user balance state (cached) ────────────────────────────────────────

  /**
   * Returns all user-specific reward-case state in a single call.
   * The result is cached under `cache:reward-cases:user-state:{username}`.
   *
   * Call `invalidateUserState(username)` after any mutation that changes
   * key balances, case opens, or XP milestone progress for this user.
   */
  async getCachedUserState(username: string) {
    // 1. Try cache
    try {
      const cached = await this.cache.getUserState(username);
      if (cached !== null) {
        this.logger.debug(
          `[RewardCases] getCachedUserState: cache hit for ${username}`,
        );
        return cached;
      }
    } catch (err) {
      this.logger.warn(
        `[RewardCases] getCachedUserState: cache read error for ${username}`,
        err,
      );
    }

    this.logger.debug(
      `[RewardCases] getCachedUserState: cache miss for ${username} — fetching DB`,
    );

    // 2. Fetch all user-specific data in parallel
    const [keyBalances, totalXp, userLevel, lastCaseOpen] = await Promise.all([
      this.getKeyBalances(username),
      this.getUserTotalXp(username),
      this.getUserLevel(username),
      this.getLastCaseOpenForUser(username),
    ]);

    const xpMilestoneProgress = await this.getXpMilestoneProgress(
      username,
      totalXp,
    );

    const state = {
      keyBalances,
      totalXp,
      userLevel,
      lastCaseOpen,
      xpMilestoneProgress,
    };

    // 3. Populate cache (best-effort)
    try {
      await this.cache.setUserState(
        username,
        state,
        REWARD_CASES_USER_STATE_TTL_SECONDS,
      );
    } catch (err) {
      this.logger.warn(
        `[RewardCases] getCachedUserState: cache write error for ${username}`,
        err,
      );
    }

    return state;
  }

  /**
   * Eagerly drops the per-user cache entry.
   * Must be called after any mutation that changes key balances,
   * case opens, or XP milestone progress for this user.
   */
  async invalidateUserState(username: string): Promise<void> {
    try {
      await this.cache.invalidateUserState(username);
    } catch (err) {
      this.logger.warn(
        `[RewardCases] invalidateUserState failed for ${username}`,
        err,
      );
    }
  }

  // ── Key balances ───────────────────────────────────────────────────────────

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
   * for UI such as global cooldown / "last opened" next to key balances.
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

    // Key balances changed — drop the per-user cache.
    await this.invalidateUserState(userUsername);
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

    // Key balances and level changed — drop the per-user cache.
    await this.invalidateUserState(userUsername);
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

    // Key balances and milestone progress changed — drop the per-user cache.
    await this.invalidateUserState(userUsername);
  }

  /** Reads the user's current cumulative XP directly from the User record. */
  async getUserTotalXp(userUsername: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { username: userUsername },
      select: { totalXP: true },
    });
    return user?.totalXP ?? 0;
  }

  /** Reads the user's current level directly from the User record. */
  async getUserLevel(userUsername: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { username: userUsername },
      select: { currentLevel: true },
    });
    return user?.currentLevel ?? 1;
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
}
