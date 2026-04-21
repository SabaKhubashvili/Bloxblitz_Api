import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  AffiliateReferrerSnapshot,
  AffiliateReferralsRange,
  AffiliateStatsRange,
  AffiliateReferralListResult,
  AffiliateSummaryRow,
  IAffiliateRepository,
  UsedReferralCodeRow,
} from '../../../../domain/referral/ports/affiliate.repository.port';

function dec(d: Prisma.Decimal | number): number {
  return typeof d === 'number' ? d : d.toNumber();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const STATS_RANGE_DAYS: Record<AffiliateStatsRange, number> = {
  '1d': 1,
  '7d': 7,
  '21d': 21,
  '30d': 30,
  '60d': 60,
  '90d': 90,
  '120d': 120,
};

@Injectable()
export class PrismaAffiliateRepository implements IAffiliateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findReferrerSnapshotForBettor(
    bettorUsername: string,
  ): Promise<AffiliateReferrerSnapshot | null> {
    const row = await this.prisma.user.findFirst({
      where: {
        username: { equals: bettorUsername, mode: 'insensitive' },
      },
      select: {
        username: true,
        referedByReferral: {
          select: { userUsername: true, referralCode: true },
        },
      },
    });
    const ref = row?.referedByReferral;
    if (!row || !ref) return null;
    return {
      bettorUsername: row.username,
      referrerUsername: ref.userUsername,
      referralCode: ref.referralCode,
    };
  }

  async getUsedReferralCode(
    username: string,
  ): Promise<UsedReferralCodeRow | null> {
    const row = await this.prisma.user.findUnique({
      where: { username },
      select: { referedBy: true, referralLastUpdate: true },
    });
    if (!row) return null;
    return {
      code: row.referedBy,
      lastChangedAt: row.referralLastUpdate,
    };
  }

  async findReferralByOwnerUsername(
    username: string,
  ): Promise<{ referralCode: string } | null> {
    const row = await this.prisma.referral.findUnique({
      where: { userUsername: username },
      select: { referralCode: true },
    });
    return row;
  }

  async findReferralByCode(
    code: string,
  ): Promise<{ userUsername: string; referralCode: string } | null> {
    return this.prisma.referral.findFirst({
      where: {
        referralCode: { equals: code, mode: 'insensitive' },
      },
      select: { userUsername: true, referralCode: true },
    });
  }

  async createOwnedReferralCode(
    ownerUsername: string,
    code: string,
  ): Promise<void> {
    await this.prisma.referral.create({
      data: {
        userUsername: ownerUsername,
        referralCode: code,
        lastReferralCodeChange: new Date(),
      },
    });
  }

  async updateUserUsedReferralCode(
    username: string,
    code: string,
    now: Date,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { username },
      data: {
        referedBy: code,
        referralLastUpdate: now,
      },
    });
  }

  async claimReferralEarnings(username: string): Promise<
    | { ok: true; claimedAmount: number; newBalance: number }
    | {
        ok: false;
        reason: 'no_referral' | 'nothing_to_claim' | 'below_minimum';
        minimum?: number;
      }
  > {
    return this.prisma.$transaction(async (tx) => {
      const ref = await tx.referral.findUnique({
        where: { userUsername: username },
      });
      if (!ref) {
        return { ok: false, reason: 'no_referral' };
      }
      const claimable = ref.claimableAmount;
      const amount = dec(claimable);
      if (amount <= 0) {
        return { ok: false, reason: 'nothing_to_claim' };
      }

      const minimum = dec(ref.minimumClaim);
      if (amount < minimum) {
        return { ok: false, reason: 'below_minimum', minimum };
      }

      const [updatedUser] = await Promise.all([
        tx.user.update({
          where: { username },
          data: {
            balance: { increment: claimable },
          },
          select: { balance: true },
        }),
        tx.referral.update({
          where: { userUsername: username },
          data: {
            claimableAmount: new Prisma.Decimal(0),
            totalClaimed: { increment: claimable },
            lastClaim: new Date(),
          },
        }),
      ]);

      return {
        ok: true,
        claimedAmount: amount,
        newBalance: dec(updatedUser.balance),
      };
    });
  }

  async getAffiliateChartData(
    ownerUsername: string,
    range: AffiliateStatsRange,
  ): Promise<{ labels: string[]; wagered: number[]; deposited: number[] }> {
    const owned = await this.findReferralByOwnerUsername(ownerUsername);
    if (!owned) {
      return emptyChartForRange(range);
    }

    const referralCode = owned.referralCode;
    const now = new Date();

    if (range === '1d') {
      return this.chartHourly(referralCode, now);
    }

    const days = STATS_RANGE_DAYS[range];
    const from = new Date(now);
    from.setUTCHours(0, 0, 0, 0);
    from.setUTCDate(from.getUTCDate() - (days - 1));

    /** Wager series from `ReferralLog` so WS games (and API) that enqueue commission count here. */
    const dailyWagered = await this.prisma.$queryRaw<
      { d: Date; total: Prisma.Decimal }[]
    >`
      SELECT date_trunc('day', rl."createdAt") AS d,
             COALESCE(SUM(rl."amount"), 0) AS total
      FROM "ReferralLog" rl
      WHERE rl."referrerCode" = ${referralCode}
        AND rl."createdAt" >= ${from}
        AND rl."createdAt" <= ${now}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const dailyDeposited = await this.prisma.$queryRaw<
      { d: Date; total: Prisma.Decimal }[]
    >`
      SELECT date_trunc('day', th."createdAt") AS d,
             COALESCE(SUM(th."coinAmountPaid"), 0) AS total
      FROM "TransactionHistory" th
      INNER JOIN "User" u ON u.username = th."userUsername"
      WHERE u."referedBy" = ${referralCode}
        AND th."direction" = 'IN'::"TransactionDirection"
        AND th."status" = 'COMPLETED'::"TransactionStatus"
        AND th."createdAt" >= ${from}
        AND th."createdAt" <= ${now}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const wagerMap = new Map<string, number>();
    const depMap = new Map<string, number>();
    for (const row of dailyWagered) {
      wagerMap.set(dayKeyUtc(row.d), dec(row.total));
    }
    for (const row of dailyDeposited) {
      depMap.set(dayKeyUtc(row.d), dec(row.total));
    }

    const labels: string[] = [];
    const wagered: number[] = [];
    const deposited: number[] = [];

    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setUTCDate(d.getUTCDate() + i);
      const key = dayKeyUtc(d);
      labels.push(formatDayLabel(d));
      wagered.push(round2(wagerMap.get(key) ?? 0));
      deposited.push(round2(depMap.get(key) ?? 0));
    }

    return { labels, wagered, deposited };
  }

  private async chartHourly(
    referralCode: string,
    now: Date,
  ): Promise<{ labels: string[]; wagered: number[]; deposited: number[] }> {
    const from = new Date(now);
    from.setUTCMinutes(0, 0, 0);
    from.setUTCHours(from.getUTCHours() - 23);

    const hourlyWagered = await this.prisma.$queryRaw<
      { h: Date; total: Prisma.Decimal }[]
    >`
      SELECT date_trunc('hour', rl."createdAt") AS h,
             COALESCE(SUM(rl."amount"), 0) AS total
      FROM "ReferralLog" rl
      WHERE rl."referrerCode" = ${referralCode}
        AND rl."createdAt" >= ${from}
        AND rl."createdAt" <= ${now}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const hourlyDeposited = await this.prisma.$queryRaw<
      { h: Date; total: Prisma.Decimal }[]
    >`
      SELECT date_trunc('hour', th."createdAt") AS h,
             COALESCE(SUM(th."coinAmountPaid"), 0) AS total
      FROM "TransactionHistory" th
      INNER JOIN "User" u ON u.username = th."userUsername"
      WHERE u."referedBy" = ${referralCode}
        AND th."direction" = 'IN'::"TransactionDirection"
        AND th."status" = 'COMPLETED'::"TransactionStatus"
        AND th."createdAt" >= ${from}
        AND th."createdAt" <= ${now}
      GROUP BY 1
      ORDER BY 1 ASC
    `;

    const wMap = new Map<string, number>();
    const dMap = new Map<string, number>();
    for (const row of hourlyWagered) {
      wMap.set(hourKeyUtc(row.h), dec(row.total));
    }
    for (const row of hourlyDeposited) {
      dMap.set(hourKeyUtc(row.h), dec(row.total));
    }

    const labels: string[] = [];
    const wagered: number[] = [];
    const deposited: number[] = [];

    const hourMs = 60 * 60 * 1000;
    for (let i = 0; i < 24; i++) {
      const slot = new Date(from.getTime() + i * hourMs);
      if (slot > now) break;
      const key = hourKeyUtc(slot);
      labels.push(formatHourLabel(slot));
      wagered.push(round2(wMap.get(key) ?? 0));
      deposited.push(round2(dMap.get(key) ?? 0));
    }

    return { labels, wagered, deposited };
  }

  async getAffiliateSummary(
    ownerUsername: string,
  ): Promise<AffiliateSummaryRow> {
    const owned = await this.findReferralByOwnerUsername(ownerUsername);
    if (!owned) {
      return {
        totalUsers: 0,
        activeUsers: 0,
        newUsers7d: 0,
        totalEarned: 0,
        ownReferralCode: null,
        claimableAmount: 0,
      };
    }

    const code = owned.referralCode;
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const activeCutoff = new Date(now);
    activeCutoff.setUTCDate(activeCutoff.getUTCDate() - 7);

    const [totals, refRow] = await Promise.all([
      this.prisma.$queryRaw<
        {
          total_users: bigint;
          active_users: bigint;
          new_users_7d: bigint;
        }[]
      >`
        SELECT
          COUNT(*)::bigint AS total_users,
          COUNT(*) FILTER (
            WHERE u."last_active_at" IS NOT NULL
              AND u."last_active_at" >= ${activeCutoff}
          )::bigint AS active_users,
          COUNT(*) FILTER (WHERE u.created_at >= ${sevenDaysAgo})::bigint AS new_users_7d
        FROM "User" u
        WHERE u."referedBy" = ${code}
      `,
      this.prisma.referral.findUnique({
        where: { userUsername: ownerUsername },
        select: {
          totalGenerated: true,
          claimableAmount: true,
          referralCode: true,
        },
      }),
    ]);

    const row = totals[0];
    return {
      totalUsers: Number(row?.total_users ?? 0),
      activeUsers: Number(row?.active_users ?? 0),
      newUsers7d: Number(row?.new_users_7d ?? 0),
      totalEarned: refRow ? dec(refRow.totalGenerated) : 0,
      ownReferralCode: refRow?.referralCode ?? owned.referralCode,
      claimableAmount: refRow ? dec(refRow.claimableAmount) : 0,
    };
  }

  async listReferrals(params: {
    ownerUsername: string;
    range: AffiliateReferralsRange;
    search: string | undefined;
    page: number;
    limit: number;
  }): Promise<AffiliateReferralListResult> {
    const owned = await this.findReferralByOwnerUsername(params.ownerUsername);
    if (!owned) {
      return {
        items: [],
        total: 0,
        page: params.page,
        limit: params.limit,
      };
    }

    const code = owned.referralCode;
    const now = new Date();
    let createdAtGte: Date | undefined;
    if (params.range === '7d') {
      createdAtGte = new Date(now);
      createdAtGte.setUTCDate(createdAtGte.getUTCDate() - 7);
    } else if (params.range === '30d') {
      createdAtGte = new Date(now);
      createdAtGte.setUTCDate(createdAtGte.getUTCDate() - 30);
    } else if (params.range === '90d') {
      createdAtGte = new Date(now);
      createdAtGte.setUTCDate(createdAtGte.getUTCDate() - 90);
    }

    const search = params.search?.trim();

    const where: Prisma.UserWhereInput = {
      referedBy: code,
      ...(createdAtGte ? { created_at: { gte: createdAtGte } } : {}),
      ...(search
        ? {
            username: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const skip = (params.page - 1) * params.limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: params.limit,
        select: {
          username: true,
          created_at: true,
          statistics: { select: { totalWagered: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const usernames = users.map((u) => u.username);
    const earnings =
      usernames.length === 0
        ? []
        : await this.prisma.referralLog.groupBy({
            by: ['referredUsername'],
            where: {
              referrerCode: code,
              referredUsername: { in: usernames },
            },

            _sum: { referrerShare: true, amount: true },
          });

    const earnedByUser = new Map<string, number>();
    for (const row of earnings) {
      earnedByUser.set(
        row.referredUsername,
        row._sum.referrerShare ? dec(row._sum.referrerShare) : 0,
      );
    }
    const wageredByUser = new Map<string, number>();
    for (const row of earnings) {
      wageredByUser.set(
        row.referredUsername,
        row._sum.amount ? dec(row._sum.amount) : 0,
      );
    }

    const items = users.map((u) => ({
      user: u.username,
      wagered: wageredByUser.get(u.username) ?? 0,
      earned: earnedByUser.get(u.username) ?? 0,
      since: u.created_at,
    }));

    return {
      items,
      total,
      page: params.page,
      limit: params.limit,
    };
  }
}

function dayKeyUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function hourKeyUtc(d: Date): string {
  return `${dayKeyUtc(d)}T${pad(d.getUTCHours())}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function formatDayLabel(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function formatHourLabel(d: Date): string {
  return `${pad(d.getUTCHours())}:00`;
}

function emptyChartForRange(range: AffiliateStatsRange): {
  labels: string[];
  wagered: number[];
  deposited: number[];
} {
  if (range === '1d') {
    const labels: string[] = [];
    const wagered: number[] = [];
    const deposited: number[] = [];
    const now = new Date();
    const from = new Date(now);
    from.setUTCMinutes(0, 0, 0);
    from.setUTCHours(from.getUTCHours() - 23);
    const hourMs = 60 * 60 * 1000;
    for (let i = 0; i < 24; i++) {
      const slot = new Date(from.getTime() + i * hourMs);
      if (slot > now) break;
      labels.push(formatHourLabel(slot));
      wagered.push(0);
      deposited.push(0);
    }
    return { labels, wagered, deposited };
  }
  const days = STATS_RANGE_DAYS[range];
  const labels: string[] = [];
  const wagered: number[] = [];
  const deposited: number[] = [];
  const now = new Date();
  const from = new Date(now);
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setUTCDate(d.getUTCDate() + i);
    labels.push(formatDayLabel(d));
    wagered.push(0);
    deposited.push(0);
  }
  return { labels, wagered, deposited };
}
