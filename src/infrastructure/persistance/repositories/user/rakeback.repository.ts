import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Rakeback, type RakebackProps } from '../../../../domain/rakeback/entities/rakeback.entity';
import { RakebackType } from '../../../../domain/rakeback/enums/rakeback-type.enum';
import type { IRakebackRepository, ClaimLogData } from '../../../../domain/rakeback/ports/rakeback.repository.port';

type PrismaRakeback = Prisma.UserRakebackGetPayload<object>;

function toNumber(d: Prisma.Decimal | number): number {
  return typeof d === 'number' ? d : d.toNumber();
}

function toDomain(row: PrismaRakeback): Rakeback {
  const props: RakebackProps = {
    id:                   row.id,
    username:             row.userUsername,
    dailyAccrued:         toNumber(row.dailyAccrued),
    weeklyAccrued:        toNumber(row.weeklyAccrued),
    monthlyAccrued:       toNumber(row.monthlyAccrued),
    dailyClaimable:       toNumber(row.dailyClaimable),
    weeklyClaimable:      toNumber(row.weeklyClaimable),
    monthlyClaimable:     toNumber(row.monthlyClaimable),
    dailyUnlocksAt:       row.dailyUnlocksAt,
    weeklyUnlocksAt:      row.weeklyUnlocksAt,
    weeklyExpiresAt:      row.weeklyExpiresAt,
    monthlyUnlocksAt:     row.monthlyUnlocksAt,
    monthlyExpiresAt:     row.monthlyExpiresAt,
    lastDailyClaim:       row.lastDailyClaim,
    lastWeeklyClaim:      row.lastWeeklyClaim,
    lastMonthlyClaim:     row.lastMonthlyClaim,
    dailyStreak:          row.dailyStreak,
    dailyLongestStreak:   row.dailyLongestStreak,
    dailyLastStreakDate:   row.dailyLastStreakDate,
    dailyStreakMultiplier: toNumber(row.dailyStreakMultiplier),
    weeklyStreak:          row.weeklyStreak,
    weeklyLongestStreak:   row.weeklyLongestStreak,
    weeklyLastStreakDate:  row.weeklyLastStreakDate,
    weeklyStreakMultiplier: toNumber(row.weeklyStreakMultiplier),
    monthlyStreak:          row.monthlyStreak,
    monthlyLongestStreak:   row.monthlyLongestStreak,
    monthlyLastStreakDate:   row.monthlyLastStreakDate,
    monthlyStreakMultiplier: toNumber(row.monthlyStreakMultiplier),
  };
  return Rakeback.fromPersistence(props);
}

function toPersistence(r: Rakeback): Prisma.UserRakebackUpdateInput {
  return {
    dailyAccrued:          r.dailyAccrued,
    weeklyAccrued:         r.weeklyAccrued,
    monthlyAccrued:        r.monthlyAccrued,
    dailyClaimable:        r.dailyClaimable,
    weeklyClaimable:       r.weeklyClaimable,
    monthlyClaimable:      r.monthlyClaimable,
    dailyUnlocksAt:        r.dailyUnlocksAt,
    weeklyUnlocksAt:       r.weeklyUnlocksAt,
    weeklyExpiresAt:       r.weeklyExpiresAt,
    monthlyUnlocksAt:      r.monthlyUnlocksAt,
    monthlyExpiresAt:      r.monthlyExpiresAt,
    lastDailyClaim:        r.lastDailyClaim,
    lastWeeklyClaim:       r.lastWeeklyClaim,
    lastMonthlyClaim:      r.lastMonthlyClaim,
    dailyStreak:           r.dailyStreak,
    dailyLongestStreak:    r.dailyLongestStreak,
    dailyLastStreakDate:    r.dailyLastStreakDate,
    dailyStreakMultiplier:  r.dailyStreakMultiplier,
    weeklyStreak:          r.weeklyStreak,
    weeklyLongestStreak:   r.weeklyLongestStreak,
    weeklyLastStreakDate:   r.weeklyLastStreakDate,
    weeklyStreakMultiplier: r.weeklyStreakMultiplier,
    monthlyStreak:          r.monthlyStreak,
    monthlyLongestStreak:   r.monthlyLongestStreak,
    monthlyLastStreakDate:   r.monthlyLastStreakDate,
    monthlyStreakMultiplier: r.monthlyStreakMultiplier,
  };
}

@Injectable()
export class PrismaRakebackRepository implements IRakebackRepository {
  private readonly logger = new Logger(PrismaRakebackRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string): Promise<Rakeback | null> {
    const row = await this.prisma.userRakeback.findUnique({
      where: { userUsername: username },
    });
    return row ? toDomain(row) : null;
  }

  async ensureExists(username: string): Promise<Rakeback> {
    const row = await this.prisma.userRakeback.upsert({
      where: { userUsername: username },
      update: {},
      create: { userUsername: username },
    });
    return toDomain(row);
  }

  async accumulateRakeback(
    username: string,
    daily: number,
    weekly: number,
    monthly: number,
  ): Promise<void> {
    await this.prisma.userRakeback.update({
      where: { userUsername: username },
      data: {
        dailyAccrued:   { increment: daily },
        weeklyAccrued:  { increment: weekly },
        monthlyAccrued: { increment: monthly },
      },
    });
  }

  async saveClaim(rakeback: Rakeback, log: ClaimLogData): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.userRakeback.update({
        where: { userUsername: rakeback.username },
        data: toPersistence(rakeback),
      }),
      this.prisma.rakebackClaimLog.create({
        data: {
          userUsername:  rakeback.username,
          type:         log.type as any,
          amountClaimed: log.amountClaimed,
          streakDay:    log.streakDay,
          streakBonus:  log.streakBonus,
          streakReset:  log.streakReset,
          balanceBefore: log.balanceBefore,
          balanceAfter:  log.balanceAfter,
        },
      }),
    ]);
  }

  async openClaimWindow(
    type: RakebackType,
    windowStart: Date,
    windowEnd: Date,
  ): Promise<number> {
    if (type === RakebackType.WEEKLY) {
      const result = await this.prisma.$executeRaw`
        UPDATE "UserRakeback"
        SET
          "weeklyClaimable" = "weeklyClaimable" + "weeklyAccrued",
          "weeklyAccrued" = 0,
          "weeklyUnlocksAt" = ${windowStart},
          "weeklyExpiresAt" = ${windowEnd},
          "updatedAt" = NOW()
      `;
      return result;
    }

    const result = await this.prisma.$executeRaw`
      UPDATE "UserRakeback"
      SET
        "monthlyClaimable" = "monthlyClaimable" + "monthlyAccrued",
        "monthlyAccrued" = 0,
        "monthlyUnlocksAt" = ${windowStart},
        "monthlyExpiresAt" = ${windowEnd},
        "updatedAt" = NOW()
    `;
    return result;
  }

  async resetMissedStreaks(type: RakebackType): Promise<number> {
    if (type === RakebackType.WEEKLY) {
      return this.prisma.$executeRaw`
        UPDATE "UserRakeback"
        SET "weeklyStreak" = 0, "updatedAt" = NOW()
        WHERE "weeklyUnlocksAt" IS NOT NULL
          AND ("lastWeeklyClaim" IS NULL OR "lastWeeklyClaim" < "weeklyUnlocksAt")
      `;
    }

    return this.prisma.$executeRaw`
      UPDATE "UserRakeback"
      SET "monthlyStreak" = 0, "updatedAt" = NOW()
      WHERE "monthlyUnlocksAt" IS NOT NULL
        AND ("lastMonthlyClaim" IS NULL OR "lastMonthlyClaim" < "monthlyUnlocksAt")
    `;
  }
}
