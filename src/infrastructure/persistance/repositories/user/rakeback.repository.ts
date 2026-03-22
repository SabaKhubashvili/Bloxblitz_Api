import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Rakeback, type RakebackProps } from '../../../../domain/rakeback/entities/rakeback.entity';
import { RakebackType } from '../../../../domain/rakeback/enums/rakeback-type.enum';
import type { IRakebackRepository, ClaimLogData } from '../../../../domain/rakeback/ports/rakeback.repository.port';
import {
  accrualDeltaForNetLossChange,
  applyDailyPositiveAccrualCap,
  netLossFromEligible,
  round2,
} from '../../../../domain/rakeback/services/rakeback-loss-accrual.policy';

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

  async applyBetResolutionForRakeback(params: {
    username: string;
    userLevel: number;
    eligibleWagerDelta: number;
    eligibleWonDelta: number;
  }): Promise<void> {
    const { username, userLevel, eligibleWagerDelta, eligibleWonDelta } = params;

    await this.prisma.$transaction(
      async (tx) => {
        const row = await tx.userRakeback.findUniqueOrThrow({
          where: { userUsername: username },
        });

        const ew = toNumber(row.eligibleWager);
        const eo = toNumber(row.eligibleWon);
        const prevNet = netLossFromEligible(ew, eo);
        const newEw = round2(ew + eligibleWagerDelta);
        const newEo = round2(eo + eligibleWonDelta);
        const nextNet = netLossFromEligible(newEw, newEo);

        let { daily: dd, weekly: dw, monthly: dm } = accrualDeltaForNetLossChange(
          userLevel,
          prevNet,
          nextNet,
        );

        const utcDay = new Date().toISOString().slice(0, 10);
        let dayTotal = toNumber(row.rakebackAccrualDayTotal);
        if (row.rakebackAccrualUtcDay !== utcDay) {
          dayTotal = 0;
        }

        const scaled = applyDailyPositiveAccrualCap(
          { daily: dd, weekly: dw, monthly: dm },
          dayTotal,
        );
        dd = scaled.daily;
        dw = scaled.weekly;
        dm = scaled.monthly;
        const newDayTotal = round2(dayTotal + scaled.appliedPositiveSum);

        const dA = Math.max(0, round2(toNumber(row.dailyAccrued) + dd));
        const wA = Math.max(0, round2(toNumber(row.weeklyAccrued) + dw));
        const mA = Math.max(0, round2(toNumber(row.monthlyAccrued) + dm));

        await tx.userRakeback.update({
          where: { userUsername: username },
          data: {
            eligibleWager: newEw,
            eligibleWon: newEo,
            rakebackAccrualUtcDay: utcDay,
            rakebackAccrualDayTotal: newDayTotal,
            dailyAccrued: dA,
            weeklyAccrued: wA,
            monthlyAccrued: mA,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10_000,
      },
    );
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
