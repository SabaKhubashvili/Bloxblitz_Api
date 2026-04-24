import { Injectable } from '@nestjs/common';
import { Prisma, RaceStatus as PrismaRaceStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { RaceStatus } from '../../../../domain/race/enums/race-status.enum';
import {
  RaceAlreadyFinishedError,
  RaceNotFoundError,
  RaceNotActiveError,
  InvalidRaceWagerError,
} from '../../../../domain/race/errors/race.errors';
import type {
  CreateRaceInput,
  IRaceRepository,
  RaceLeaderboardEntry,
  RaceParticipantAfterIncrement,
  RaceParticipantSnapshot,
  RaceRecord,
  RaceRewardRecord,
} from '../../../../domain/race/ports/race.repository.port';
import { PrismaService } from '../../prisma/prisma.service';

function decStr(d: Prisma.Decimal): string {
  return d.toString();
}

function toRaceRecord(row: {
  id: string;
  startTime: Date;
  endTime: Date;
  status: PrismaRaceStatus;
  totalPrizePool: Prisma.Decimal | null;
  trackingPaused: boolean;
  raceWindow: string | null;
}): RaceRecord {
  return {
    id: row.id,
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status as RaceStatus,
    totalPrizePool: row.totalPrizePool ? decStr(row.totalPrizePool) : null,
    trackingPaused: row.trackingPaused,
    raceWindow: row.raceWindow,
  };
}

type RankedRow = {
  raceId: string;
  userUsername: string;
  wageredAmount: Prisma.Decimal;
  updatedAt: Date;
  username: string;
  profilePicture: string;
  position: number;
};

const LIVE_STATUSES: PrismaRaceStatus[] = [
  PrismaRaceStatus.ACTIVE,
  PrismaRaceStatus.PAUSED,
];

const OVERLAP_STATUSES: PrismaRaceStatus[] = [
  PrismaRaceStatus.SCHEDULED,
  PrismaRaceStatus.ACTIVE,
  PrismaRaceStatus.PAUSED,
];

@Injectable()
export class PrismaRaceRepository implements IRaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveRace(): Promise<RaceRecord | null> {
    const now = new Date();
    const row = await this.prisma.race.findFirst({
      where: {
        status: { in: LIVE_STATUSES },
        startTime: { lte: now },
        endTime: { gt: now },
      },
      orderBy: { startTime: 'desc' },
    });
    return row ? toRaceRecord(row) : null;
  }

  async findRaceById(id: string): Promise<RaceRecord | null> {
    const row = await this.prisma.race.findUnique({ where: { id } });
    return row ? toRaceRecord(row) : null;
  }

  async findRewardsByRaceId(raceId: string): Promise<RaceRewardRecord[]> {
    const rows = await this.prisma.raceReward.findMany({
      where: { raceId },
      orderBy: { position: 'asc' },
    });
    return rows.map((r) => ({
      raceId: r.raceId,
      position: r.position,
      rewardAmount: decStr(r.rewardAmount),
    }));
  }

  async findRewardsByRaceIds(
    raceIds: string[],
  ): Promise<Map<string, RaceRewardRecord[]>> {
    const out = new Map<string, RaceRewardRecord[]>();
    if (raceIds.length === 0) return out;

    const rows = await this.prisma.raceReward.findMany({
      where: { raceId: { in: raceIds } },
      orderBy: [{ raceId: 'asc' }, { position: 'asc' }],
    });

    for (const r of rows) {
      const list = out.get(r.raceId) ?? [];
      list.push({
        raceId: r.raceId,
        position: r.position,
        rewardAmount: decStr(r.rewardAmount),
      });
      out.set(r.raceId, list);
    }

    return out;
  }

  async findLeaderboardTop(
    raceId: string,
    limit: number,
  ): Promise<RaceLeaderboardEntry[]> {
    const rows = await this.prisma.raceParticipant.findMany({
      where: { raceId },
      orderBy: [{ wageredAmount: 'desc' }, { updatedAt: 'asc' }],
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            profile_picture: true,
          },
        },
      },
    });
    return rows.map((r, i) => ({
      userId: r.user.id,
      position: i + 1,
      username: r.user.username,
      profilePicture: r.user.profile_picture,
      wageredAmount: decStr(r.wageredAmount),
      updatedAt: r.updatedAt,
    }));
  }

  async findLeaderboardTopForRaces(
    raceIds: string[],
    limit: number,
  ): Promise<Map<string, RaceLeaderboardEntry[]>> {
    const out = new Map<string, RaceLeaderboardEntry[]>();
    if (raceIds.length === 0) return out;

    const ranked = await this.prisma.$queryRaw<RankedRow[]>`
      SELECT * FROM (
        SELECT
          p."raceId",
          p."userUsername",
          p."wageredAmount",
          p."updatedAt",
          u."username",
          u."profile_picture" AS "profilePicture",
          (ROW_NUMBER() OVER (
            PARTITION BY p."raceId"
            ORDER BY p."wageredAmount" DESC, p."updatedAt" ASC
          ))::int AS position
        FROM "RaceParticipant" p
        INNER JOIN "User" u ON u."username" = p."userUsername"
        WHERE p."raceId" IN (${Prisma.join(raceIds)})
      ) sub
      WHERE sub.position <= ${limit}
      ORDER BY sub."raceId" ASC, sub.position ASC
    `;

    for (const r of ranked) {
      const list = out.get(r.raceId) ?? [];
      list.push({
        position: r.position,
        username: r.username,
        profilePicture: r.profilePicture,
        wageredAmount: decStr(r.wageredAmount),
        updatedAt: r.updatedAt,
      });
      out.set(r.raceId, list);
    }

    return out;
  }

  async incrementWager(
    raceId: string,
    userUsername: string,
    delta: string,
  ): Promise<RaceParticipantAfterIncrement> {
    const race = await this.prisma.race.findUnique({
      where: { id: raceId },
      select: { status: true, trackingPaused: true },
    });
    if (!race) {
      throw new RaceNotFoundError();
    }
    if (race.status !== PrismaRaceStatus.ACTIVE || race.trackingPaused) {
      throw new RaceNotActiveError();
    }

    const d = new Prisma.Decimal(delta);
    if (d.lte(0)) {
      throw new InvalidRaceWagerError();
    }

    const row = await this.prisma.raceParticipant.upsert({
      where: {
        raceId_userUsername: { raceId, userUsername },
      },
      create: {
        raceId,
        userUsername,
        wageredAmount: d,
        updatedAt: new Date(),
      },
      update: {
        wageredAmount: { increment: d },
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, username: true, profile_picture: true },
        },
      },
    });

    return {
      userId: row.user.id,
      username: row.userUsername,
      profilePicture: row.user.profile_picture,
      wageredAmount: decStr(row.wageredAmount),
      updatedAt: row.updatedAt,
    };
  }

  async getParticipant(
    raceId: string,
    userUsername: string,
  ): Promise<RaceParticipantSnapshot | null> {
    const row = await this.prisma.raceParticipant.findUnique({
      where: { raceId_userUsername: { raceId, userUsername } },
    });
    if (!row) return null;
    return {
      username: row.userUsername,
      wageredAmount: decStr(row.wageredAmount),
      updatedAt: row.updatedAt,
      finalRank: row.finalRank,
    };
  }

  async countParticipantsAhead(
    raceId: string,
    wageredAmount: string,
    updatedAt: Date,
  ): Promise<number> {
    const dec = new Prisma.Decimal(wageredAmount);
    return this.prisma.raceParticipant.count({
      where: {
        raceId,
        OR: [
          { wageredAmount: { gt: dec } },
          {
            AND: [{ wageredAmount: dec }, { updatedAt: { lt: updatedAt } }],
          },
        ],
      },
    });
  }

  async finishRace(raceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "Race" WHERE "id" = ${raceId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new RaceNotFoundError();
      }

      const race = await tx.race.findUnique({ where: { id: raceId } });
      if (!race) {
        throw new RaceNotFoundError();
      }
      if (
        race.status !== PrismaRaceStatus.ACTIVE &&
        race.status !== PrismaRaceStatus.PAUSED
      ) {
        throw new RaceAlreadyFinishedError();
      }

      await tx.$executeRaw`
        WITH ranked AS (
          SELECT "id",
                 ROW_NUMBER() OVER (
                   PARTITION BY "raceId"
                   ORDER BY "wageredAmount" DESC, "updatedAt" ASC
                 ) AS rn
          FROM "RaceParticipant"
          WHERE "raceId" = ${raceId}
        )
        UPDATE "RaceParticipant" AS rp
        SET "finalRank" = ranked.rn
        FROM ranked
        WHERE rp."id" = ranked."id"
      `;

      const sumRewards = await tx.raceReward.aggregate({
        where: { raceId },
        _sum: { rewardAmount: true },
      });

      await tx.race.update({
        where: { id: raceId },
        data: {
          status: PrismaRaceStatus.FINISHED,
          trackingPaused: false,
          totalPrizePool: sumRewards._sum.rewardAmount ?? new Prisma.Decimal(0),
        },
      });
    });
  }

  async listFinishedRaces(
    offset: number,
    limit: number,
  ): Promise<RaceRecord[]> {
    const rows = await this.prisma.race.findMany({
      where: {
        status: {
          in: [PrismaRaceStatus.FINISHED, PrismaRaceStatus.CANCELLED],
        },
      },
      orderBy: { endTime: 'desc' },
      skip: offset,
      take: limit,
    });
    return rows.map(toRaceRecord);
  }

  async findRaceOverlappingTimeRange(
    startTime: Date,
    endTime: Date,
  ): Promise<RaceRecord | null> {
    const row = await this.prisma.race.findFirst({
      where: {
        status: { in: OVERLAP_STATUSES },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
    });
    return row ? toRaceRecord(row) : null;
  }

  async createRaceWithRewards(input: CreateRaceInput): Promise<string> {
    const id = randomUUID();
    const rewards = input.rewards.map((r) => ({
      position: r.position,
      rewardAmount: new Prisma.Decimal(r.rewardAmount),
    }));
    let total = new Prisma.Decimal(0);
    for (const r of rewards) {
      total = total.plus(r.rewardAmount);
    }

    const status =
      input.startTime.getTime() > Date.now()
        ? PrismaRaceStatus.SCHEDULED
        : PrismaRaceStatus.ACTIVE;

    await this.prisma.race.create({
      data: {
        id,
        startTime: input.startTime,
        endTime: input.endTime,
        status,
        trackingPaused: false,
        totalPrizePool: total,
        rewards: { create: rewards },
      },
    });

    return id;
  }

  async promoteDueScheduledRaces(now: Date): Promise<number> {
    const due = await this.prisma.race.findMany({
      where: {
        status: PrismaRaceStatus.SCHEDULED,
        startTime: { lte: now },
        endTime: { gt: now },
      },
      orderBy: { startTime: 'asc' },
    });
    let n = 0;
    for (const r of due) {
      await this.prisma.race.update({
        where: { id: r.id },
        data: { status: PrismaRaceStatus.ACTIVE },
      });
      n += 1;
    }
    return n;
  }

  async findExpiredLiveRaceIds(now: Date): Promise<string[]> {
    const rows = await this.prisma.race.findMany({
      where: {
        status: { in: LIVE_STATUSES },
        endTime: { lte: now },
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }
}
