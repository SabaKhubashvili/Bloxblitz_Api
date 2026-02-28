import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';
import { RakebackType as DtoRakeBackType } from './dto/claim-rakeback.dto';
import { UserRepository } from '../user.repository';
import { RakebackType } from '@prisma/client';

@Injectable() 
export class RakebackService {
  private readonly logger = new Logger(RakebackService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly userRepository: UserRepository
  ) {}
  async getUserRakeback(username: string) {
    try {
      const cachedRackeback = await this.redis.mainClient.get(
        RedisKeys.user.rakeback.user(username),
      );

      // if (cachedRackeback) {
      //   return {
      //     status: 'success',
      //     data: JSON.parse(cachedRackeback) as {
      //       dailyAccrued: number;
      //       weeklyAccrued: number;
      //       monthlyAccrued: number;
      //       dailyUnlocksAt: Date | null;
      //       weeklyUnlocksAt: Date | null;
      //       monthlyUnlocksAt: Date | null;
      //       dailyStreak: number;
      //       weeklyStreak: number;
      //       monthlyStreak: number;
      //       dailyClaimable: number;
      //       weeklyClaimable: number;
      //       monthlyClaimable: number;
      //     },
      //   };
      // }
      let rakebackData = await this.prisma.userRakeback.findUnique({
        where: { userUsername: username },
      });
      if (!rakebackData) {
        rakebackData = await this.prisma.userRakeback.create({
          data: {
            userUsername: username,
            dailyUnlocksAt: new Date(0),
            weeklyUnlocksAt: new Date(0),
            monthlyUnlocksAt: new Date(0),
          },
        });
      }
      const {
        dailyAccrued,
        weeklyAccrued,
        monthlyAccrued,
        dailyUnlocksAt,
        weeklyUnlocksAt,
        monthlyUnlocksAt,
        dailyStreak,
        weeklyStreak,
        monthlyStreak,
        dailyStreakMultiplier,
        weeklyStreakMultiplier,
        monthlyStreakMultiplier
      } = rakebackData;
      const dailyClaimable =  parseFloat((dailyAccrued.toNumber() * dailyStreakMultiplier.toNumber()).toFixed(2));
      const weeklyClaimable = parseFloat((weeklyAccrued.toNumber() * weeklyStreakMultiplier.toNumber()).toFixed(2));
      const monthlyClaimable = parseFloat((monthlyAccrued.toNumber() * monthlyStreakMultiplier.toNumber()).toFixed(2));
      this.logger.log(`Fetched rakeback data for user ${username} from database`);
      this.logger.log(`Streak Multipliers - Daily: ${dailyStreakMultiplier.toNumber()}, Weekly: ${weeklyStreakMultiplier.toNumber()}, Monthly: ${monthlyStreakMultiplier.toNumber()}`);
      this.logger.debug(`User ${username} rakeback data: dailyAccrued=${dailyAccrued}, weeklyAccrued=${weeklyAccrued}, monthlyAccrued=${monthlyAccrued}, dailyUnlocksAt=${dailyUnlocksAt}, weeklyUnlocksAt=${weeklyUnlocksAt}, monthlyUnlocksAt=${monthlyUnlocksAt}, dailyStreak=${dailyStreak}, weeklyStreak=${weeklyStreak}, monthlyStreak=${monthlyStreak}, dailyClaimable=${dailyClaimable}, weeklyClaimable=${weeklyClaimable}, monthlyClaimable=${monthlyClaimable}`);
      await this.redis.mainClient.setEx(
        RedisKeys.user.rakeback.user(username),
        3600,
        JSON.stringify({
          dailyAccrued,
          weeklyAccrued,
          monthlyAccrued,
          dailyUnlocksAt,
          weeklyUnlocksAt,
          monthlyUnlocksAt,
          dailyStreak,
          weeklyStreak,
          monthlyStreak,
          dailyClaimable,
          weeklyClaimable,
          monthlyClaimable
        }),
      );
      return {
        status: 'success',
        data: {
          dailyAccrued,
          weeklyAccrued,
          monthlyAccrued,
          dailyUnlocksAt,
          weeklyUnlocksAt,
          monthlyUnlocksAt,
          dailyStreak,
          weeklyStreak,
          monthlyStreak,
          dailyClaimable,
          weeklyClaimable,
          monthlyClaimable
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to retrieve rakeback information',
      );
    }
  }
async claimUserRakeback(username: string, type: DtoRakeBackType) {
  try {
    const rakebackData = await this.prisma.userRakeback.findUnique({
      where: { userUsername: username },
    });

    if (!rakebackData) {
      throw new InternalServerErrorException('Rakeback data not found');
    }

    const now = new Date();
    let nextUnlocksAt: Date | null = null;

    if (type === DtoRakeBackType.DAILY) {
      // ── Guards ──────────────────────────────────────────────────────────────
      if (rakebackData.dailyAccrued.toNumber() <= 0) {
        throw new BadRequestException('No daily rakeback to claim');
      }
      if (!rakebackData.dailyUnlocksAt || rakebackData.dailyUnlocksAt > now) {
        throw new BadRequestException('Daily rakeback not yet unlocked');
      }

      // ── Streak logic ────────────────────────────────────────────────────────

      const newStreak = rakebackData.dailyStreak ? rakebackData.dailyStreak + 1 : 1;
      const newLongestStreak = Math.max(rakebackData.dailyLongestStreak, newStreak);

      // ── Multiplier: 5% per streak day, capped at 100% (day 20) ─────────────
      // e.g. day 1 → 0.05, day 10 → 0.50, day 20+ → 1.00
      const newMultiplier = Math.min(newStreak * 0.05, 1.0);

      // ── Claimable amount after multiplier ───────────────────────────────────
      const accrued = rakebackData.dailyAccrued.toNumber();
      const claimableAmount = parseFloat((accrued * newMultiplier).toFixed(2));

      // ── Persist ─────────────────────────────────────────────────────────────
      await this.prisma.$transaction(async (tx) => {
        // 1. Update rakeback record
        await tx.userRakeback.update({
          where: { userUsername: username },
          data: {
            // Reset accrued & unlock window
            dailyAccrued: accrued - claimableAmount,
            dailyUnlocksAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // next unlock in 24 h

            // Move to claimable (stack on top of existing unclaimed amount)
            // dailyClaimable: {
            //   decrement: claimableAmount,
            // },

            // Streak fields
            dailyStreak: newStreak,
            dailyLongestStreak: newLongestStreak,
            dailyLastStreakDate: now,
            dailyStreakMultiplier: newMultiplier,

            // Claim timestamp
            lastDailyClaim: now,
          },
        });

        // 2. Credit balance
        await this.userRepository.incrementUserBalance(username, claimableAmount);

        // 3. Log the claim
        await tx.rakebackClaimLog.create({
          data: {
            userUsername: username,
            type: RakebackType.DAILY,
            amountClaimed: claimableAmount,
            streakDay: newStreak,
            streakBonus: newMultiplier,
            streakReset: newStreak === 1, 
            balanceBefore: rakebackData.dailyClaimable.toNumber(),
            balanceAfter: rakebackData.dailyClaimable.toNumber() + claimableAmount,
          },
        });
      });

      // 4. Bust cache
      await this.redis.del(RedisKeys.user.rakeback.user(username));

      return {
        claimed: claimableAmount,
        streak: newStreak,
        multiplier: newMultiplier,
        streakReset: newStreak === 1, 
        nextUnlocksAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    if (type === DtoRakeBackType.WEEKLY) {
      if (rakebackData.weeklyAccrued.toNumber() <= 0) {
        throw new BadRequestException('No weekly rakeback to claim');
      }
      if (!rakebackData.weeklyUnlocksAt || rakebackData.weeklyUnlocksAt > now) {
        throw new BadRequestException('Weekly rakeback not yet unlocked');
      }
      if (rakebackData.weeklyExpiresAt && rakebackData.weeklyExpiresAt < now) {
        throw new BadRequestException('Weekly rakeback window has expired');
      }

      // Streak: must claim every Saturday window — if last claim was > 14 days ago, reset
      const lastClaim = rakebackData.lastWeeklyClaim;
      const daysSinceLastClaim = lastClaim
        ? (now.getTime() - lastClaim.getTime()) / 1000 / 60 / 60 / 24
        : Infinity;

      const streakAlive = daysSinceLastClaim <= 14;
      const newStreak = streakAlive ? rakebackData.weeklyStreak + 1 : 1;
      const newLongestStreak = Math.max(rakebackData.weeklyLongestStreak, newStreak);
      const newMultiplier = Math.min(newStreak * 0.05, 1.0);

      const accrued = rakebackData.weeklyAccrued.toNumber();
      const claimableAmount = parseFloat((accrued * newMultiplier).toFixed(2));

      await this.prisma.$transaction(async (tx) => {
        await tx.userRakeback.update({
          where: { userUsername: username },
          data: {
            weeklyAccrued: 0,
            weeklyUnlocksAt: null,
            weeklyExpiresAt: null,
            weeklyClaimable: { increment: claimableAmount },
            weeklyStreak: newStreak,
            weeklyLongestStreak: newLongestStreak,
            weeklyLastStreakDate: now,
            weeklyStreakMultiplier: newMultiplier,
            lastWeeklyClaim: now,
          },
        });

        await tx.user.update({
          where: { username },
          data: { balance: { increment: claimableAmount } },
        });

        await tx.rakebackClaimLog.create({
          data: {
            userUsername: username,
            type: RakebackType.WEEKLY,
            amountClaimed: claimableAmount,
            streakDay: newStreak,
            streakBonus: newMultiplier,
            streakReset: !streakAlive,
            balanceBefore: rakebackData.weeklyClaimable.toNumber(),
            balanceAfter: rakebackData.weeklyClaimable.toNumber() + claimableAmount,
          },
        });
      });

      await this.redis.del(RedisKeys.user.rakeback.user(username));

      return {
        claimed: claimableAmount,
        streak: newStreak,
        multiplier: newMultiplier,
        streakReset: !streakAlive,
      };
    }

    if (type === DtoRakeBackType.MONTHLY) {
      if (rakebackData.monthlyAccrued.toNumber() <= 0) {
        throw new BadRequestException('No monthly rakeback to claim');
      }
      if (!rakebackData.monthlyUnlocksAt || rakebackData.monthlyUnlocksAt > now) {
        throw new BadRequestException('Monthly rakeback not yet unlocked');
      }
      if (rakebackData.monthlyExpiresAt && rakebackData.monthlyExpiresAt < now) {
        throw new BadRequestException('Monthly rakeback window has expired');
      }

      // Streak: must claim every month — if last claim was > 35 days ago, reset
      const lastClaim = rakebackData.lastMonthlyClaim;
      const daysSinceLastClaim = lastClaim
        ? (now.getTime() - lastClaim.getTime()) / 1000 / 60 / 60 / 24
        : Infinity;

      const streakAlive = daysSinceLastClaim <= 35;
      const newStreak = streakAlive ? rakebackData.monthlyStreak + 1 : 1;
      const newLongestStreak = Math.max(rakebackData.monthlyLongestStreak, newStreak);
      const newMultiplier = Math.min(newStreak * 0.05, 1.0);

      const accrued = rakebackData.monthlyAccrued.toNumber();
      const claimableAmount = parseFloat((accrued * newMultiplier).toFixed(2));

      await this.prisma.$transaction(async (tx) => {
        await tx.userRakeback.update({
          where: { userUsername: username },
          data: {
            monthlyAccrued: 0,
            monthlyUnlocksAt: null,
            monthlyExpiresAt: null,
            monthlyClaimable: { increment: claimableAmount },
            monthlyStreak: newStreak,
            monthlyLongestStreak: newLongestStreak,
            monthlyLastStreakDate: now,
            monthlyStreakMultiplier: newMultiplier,
            lastMonthlyClaim: now,
          },
        });

        await tx.user.update({
          where: { username },
          data: { balance: { increment: claimableAmount } },
        });

        await tx.rakebackClaimLog.create({
          data: {
            userUsername: username,
            type: RakebackType.MONTHLY,
            amountClaimed: claimableAmount,
            streakDay: newStreak,
            streakBonus: newMultiplier,
            streakReset: !streakAlive,
            balanceBefore: rakebackData.monthlyClaimable.toNumber(),
            balanceAfter: rakebackData.monthlyClaimable.toNumber() + claimableAmount,
          },
        });
      });

      await this.redis.del(RedisKeys.user.rakeback.user(username));

      return {
        claimed: claimableAmount,
        streak: newStreak,
        multiplier: newMultiplier,
        streakReset: !streakAlive,
      };
    }

    throw new BadRequestException('Invalid rakeback type');

  } catch (error) {
    if (
      error instanceof BadRequestException ||
      error instanceof InternalServerErrorException
    ) {
      throw error;
    }
    throw new InternalServerErrorException('Failed to claim rakeback');
  }
}
}
