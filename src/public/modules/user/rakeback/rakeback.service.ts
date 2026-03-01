import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';
import { RakebackType as DtoRakeBackType } from './dto/claim-rakeback.dto';
import { UserRepository } from '../user.repository';
import { RakebackType } from '@prisma/client';
import {
  getWeeklyClaimWindow,
  getMonthlyClaimWindow,
} from './utils/rakeback-rewards-window.util';

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RakebackService {
  private readonly logger = new Logger(RakebackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly userRepository: UserRepository,
  ) {}

  // ── getUserRakeback ─────────────────────────────────────────────────────────

  async getUserRakeback(username: string) {
    try {
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
        dailyStreak,
        weeklyStreak,
        monthlyStreak,
        dailyStreakMultiplier,
        weeklyStreakMultiplier,
        monthlyStreakMultiplier,
        lastWeeklyClaim,
        lastMonthlyClaim,
      } = rakebackData;

      const now = new Date();

      // ── Weekly window ──────────────────────────────────────────────────────
      const currentWeeklyWindow = getWeeklyClaimWindow(now);

      const weeklyAlreadyClaimed =
        !!lastWeeklyClaim &&
        lastWeeklyClaim >= currentWeeklyWindow.unlocksAt &&
        lastWeeklyClaim < currentWeeklyWindow.expiresAt;

      const nextWeeklyWindow = getWeeklyClaimWindow(
        new Date(currentWeeklyWindow.expiresAt.getTime() + 1),
      );

      const weeklyUnlocksAt = weeklyAlreadyClaimed
        ? nextWeeklyWindow.unlocksAt
        : currentWeeklyWindow.unlocksAt;

      const weeklyExpiresAt = weeklyAlreadyClaimed
        ? nextWeeklyWindow.expiresAt
        : currentWeeklyWindow.expiresAt;

      // ── Monthly window ─────────────────────────────────────────────────────
      const currentMonthlyWindow = getMonthlyClaimWindow(now);

      const monthlyAlreadyClaimed =
        !!lastMonthlyClaim &&
        lastMonthlyClaim >= currentMonthlyWindow.unlocksAt &&
        lastMonthlyClaim < currentMonthlyWindow.expiresAt;

      const nextMonthlyWindow = getMonthlyClaimWindow(
        new Date(currentMonthlyWindow.expiresAt.getTime() + 1),
      );

      const monthlyUnlocksAt = monthlyAlreadyClaimed
        ? nextMonthlyWindow.unlocksAt
        : currentMonthlyWindow.unlocksAt;

      const monthlyExpiresAt = monthlyAlreadyClaimed
        ? nextMonthlyWindow.expiresAt
        : currentMonthlyWindow.expiresAt;

      // ── Claimable flags ────────────────────────────────────────────────────
      const isWeeklyClaimable =
        now >= currentWeeklyWindow.unlocksAt &&
        now < currentWeeklyWindow.expiresAt &&
        !weeklyAlreadyClaimed;

      const isMonthlyClaimable =
        now >= currentMonthlyWindow.unlocksAt &&
        now < currentMonthlyWindow.expiresAt &&
        !monthlyAlreadyClaimed;

      // ── Claimable amounts (use stored multipliers — what user sees) ─────────
      const dailyClaimable = parseFloat(
        (dailyAccrued.toNumber() * dailyStreakMultiplier.toNumber()).toFixed(2),
      );
      const weeklyClaimable = weeklyAccrued
      const monthlyClaimable = monthlyAccrued

      this.logger.log(`Fetched rakeback data for user ${username}`);
      this.logger.log(
        `Streak Multipliers — Daily: ${dailyStreakMultiplier.toNumber()}, ` +
          `Weekly: ${weeklyStreakMultiplier.toNumber()}, Monthly: ${monthlyStreakMultiplier.toNumber()}`,
      );
      this.logger.debug(
        `User ${username}: dailyAccrued=${dailyAccrued}, weeklyAccrued=${weeklyAccrued}, ` +
          `monthlyAccrued=${monthlyAccrued}, dailyUnlocksAt=${dailyUnlocksAt}, ` +
          `weeklyWindow=${weeklyUnlocksAt.toISOString()}–${weeklyExpiresAt.toISOString()} ` +
          `(claimable=${isWeeklyClaimable}, alreadyClaimed=${weeklyAlreadyClaimed}), ` +
          `monthlyWindow=${monthlyUnlocksAt.toISOString()}–${monthlyExpiresAt.toISOString()} ` +
          `(claimable=${isMonthlyClaimable}, alreadyClaimed=${monthlyAlreadyClaimed})`,
      );

      const payload = {
        dailyAccrued,
        weeklyAccrued,
        monthlyAccrued,
        dailyUnlocksAt,
        weeklyUnlocksAt,
        weeklyExpiresAt,
        weeklyAlreadyClaimed,
        monthlyUnlocksAt,
        monthlyExpiresAt,
        monthlyAlreadyClaimed,
        isWeeklyClaimable,
        isMonthlyClaimable,
        dailyStreak,
        weeklyStreak,
        monthlyStreak,
        dailyClaimable,
        weeklyClaimable,
        monthlyClaimable,
      };

      await this.redis.mainClient.setEx(
        RedisKeys.user.rakeback.user(username),
        3600,
        JSON.stringify(payload),
      );

      return { status: 'success', data: payload };
    } catch (error) {
      this.logger.error(
        `Failed to retrieve rakeback for user ${username}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        'Failed to retrieve rakeback information',
      );
    }
  }

  // ── claimUserRakeback ───────────────────────────────────────────────────────

  async claimUserRakeback(username: string, type: DtoRakeBackType) {
    try {
      const rakebackData = await this.prisma.userRakeback.findUnique({
        where: { userUsername: username },
      });

      if (!rakebackData) {
        throw new InternalServerErrorException('Rakeback data not found');
      }

      const now = new Date();

      // ── DAILY ─────────────────────────────────────────────────────────────
      if (type === DtoRakeBackType.DAILY) {
        const accrued = rakebackData.dailyAccrued.toNumber();

        if (accrued <= 0) {
          throw new BadRequestException('No daily rakeback to claim');
        }
        if (!rakebackData.dailyUnlocksAt || rakebackData.dailyUnlocksAt > now) {
          throw new BadRequestException('Daily rakeback not yet unlocked');
        }

        // Use the stored multiplier (what the UI showed the user), then
        // increment streak + compute next multiplier for storage.
        const currentMultiplier = rakebackData.dailyStreakMultiplier.toNumber();
        const claimableAmount = parseFloat(
          (accrued * currentMultiplier).toFixed(2),
        );

        const newStreak = (rakebackData.dailyStreak ?? 0) + 1;
        const newLongestStreak = Math.max(
          rakebackData.dailyLongestStreak,
          newStreak,
        );
        const newMultiplier = parseFloat(
          Math.min(newStreak * 0.05, 1.0).toFixed(4),
        );
        const nextUnlocksAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        await this.prisma.$transaction(async (tx) => {
          await tx.userRakeback.update({
            where: { userUsername: username },
            data: {
              dailyAccrued: { decrement: claimableAmount },
              dailyUnlocksAt: nextUnlocksAt,
              dailyStreak: newStreak,
              dailyLongestStreak: newLongestStreak,
              dailyLastStreakDate: now,
              dailyStreakMultiplier: newMultiplier,
              lastDailyClaim: now,
            },
          });

          await this.userRepository.incrementUserBalance(
            username,
            claimableAmount,
          );

          await tx.rakebackClaimLog.create({
            data: {
              userUsername: username,
              type: RakebackType.DAILY,
              amountClaimed: claimableAmount,
              streakDay: newStreak,
              streakBonus: currentMultiplier,
              streakReset: newStreak === 1,
              balanceBefore: accrued,
              balanceAfter: accrued - claimableAmount,
            },
          });
        });

        await this.redis.del(RedisKeys.user.rakeback.user(username));

        return {
          claimed: claimableAmount,
          streak: newStreak,
          multiplier: newMultiplier,
          streakReset: newStreak === 1,
          nextUnlocksAt,
        };
      }

      // ── WEEKLY ────────────────────────────────────────────────────────────
      if (type === DtoRakeBackType.WEEKLY) {
        const accrued = rakebackData.weeklyAccrued.toNumber();

        if (accrued <= 0) {
          throw new BadRequestException('No weekly rakeback to claim');
        }

        const { unlocksAt: weeklyOpen, expiresAt: weeklyClose } =
          getWeeklyClaimWindow(now);

        if (now < weeklyOpen || now >= weeklyClose) {
          throw new BadRequestException(
            `Weekly rakeback is only claimable Saturday 17:00 UTC – Sunday 17:00 UTC. ` +
              `Next window opens at ${weeklyOpen.toISOString()}.`,
          );
        }

        if (
          rakebackData.lastWeeklyClaim &&
          rakebackData.lastWeeklyClaim >= weeklyOpen &&
          rakebackData.lastWeeklyClaim < weeklyClose
        ) {
          const nextWindow = getWeeklyClaimWindow(
            new Date(weeklyClose.getTime() + 1),
          );
          throw new BadRequestException(
            `You have already claimed your weekly rakeback for this window. ` +
              `Next window opens at ${nextWindow.unlocksAt.toISOString()}.`,
          );
        }

        const lastClaim = rakebackData.lastWeeklyClaim;
        const daysSinceLastClaim = lastClaim
          ? (now.getTime() - lastClaim.getTime()) / 1000 / 60 / 60 / 24
          : Infinity;

        const streakAlive = daysSinceLastClaim <= 14;
        const newStreak = streakAlive ? rakebackData.weeklyStreak + 1 : 1;
        const newLongestStreak = Math.max(
          rakebackData.weeklyLongestStreak,
          newStreak,
        );

        // Use stored multiplier for the payout, store new one for next claim
        const currentMultiplier = rakebackData.weeklyStreakMultiplier.toNumber();
        const claimableAmount = parseFloat(
          (accrued * currentMultiplier).toFixed(2),
        );
        const newMultiplier = parseFloat(
          Math.min(newStreak * 0.05, 1.0).toFixed(4),
        );

        await this.prisma.$transaction(async (tx) => {
          await tx.userRakeback.update({
            where: { userUsername: username },
            data: {
              weeklyAccrued: { decrement: claimableAmount },
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
              streakBonus: currentMultiplier,
              streakReset: !streakAlive,
              balanceBefore: accrued,
              balanceAfter: accrued - claimableAmount,
            },
          });
        });

        await this.redis.del(RedisKeys.user.rakeback.user(username));

        return {
          claimed: claimableAmount,
          streak: newStreak,
          multiplier: newMultiplier,
          streakReset: !streakAlive,
          windowClosesAt: weeklyClose,
        };
      }

      // ── MONTHLY ───────────────────────────────────────────────────────────
      if (type === DtoRakeBackType.MONTHLY) {
        const accrued = rakebackData.monthlyAccrued.toNumber();

        if (accrued <= 0) {
          throw new BadRequestException('No monthly rakeback to claim');
        }

        const { unlocksAt: monthlyOpen, expiresAt: monthlyClose } =
          getMonthlyClaimWindow(now);

        if (now < monthlyOpen || now >= monthlyClose) {
          throw new BadRequestException(
            `Monthly rakeback is only claimable on the 1st of each month 17:00 UTC for 24 h. ` +
              `Next window opens at ${monthlyOpen.toISOString()}.`,
          );
        }

        if (
          rakebackData.lastMonthlyClaim &&
          rakebackData.lastMonthlyClaim >= monthlyOpen &&
          rakebackData.lastMonthlyClaim < monthlyClose
        ) {
          const nextWindow = getMonthlyClaimWindow(
            new Date(monthlyClose.getTime() + 1),
          );
          throw new BadRequestException(
            `You have already claimed your monthly rakeback for this window. ` +
              `Next window opens at ${nextWindow.unlocksAt.toISOString()}.`,
          );
        }

        const lastClaim = rakebackData.lastMonthlyClaim;
        const daysSinceLastClaim = lastClaim
          ? (now.getTime() - lastClaim.getTime()) / 1000 / 60 / 60 / 24
          : Infinity;

        const streakAlive = daysSinceLastClaim <= 35;
        const newStreak = streakAlive ? rakebackData.monthlyStreak + 1 : 1;
        const newLongestStreak = Math.max(
          rakebackData.monthlyLongestStreak,
          newStreak,
        );

        // Use stored multiplier for the payout, store new one for next claim
        const currentMultiplier = rakebackData.monthlyStreakMultiplier.toNumber();
        const claimableAmount = accrued
        const newMultiplier = parseFloat(
          Math.min(newStreak * 0.05, 1.0).toFixed(4),
        );

        await this.prisma.$transaction(async (tx) => {
          await tx.userRakeback.update({
            where: { userUsername: username },
            data: {
              monthlyAccrued: { decrement: claimableAmount },
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
              streakBonus: currentMultiplier,
              streakReset: !streakAlive,
              balanceBefore: accrued,
              balanceAfter: accrued - claimableAmount,
            },
          });
        });

        await this.redis.del(RedisKeys.user.rakeback.user(username));

        return {
          claimed: claimableAmount,
          streak: newStreak,
          multiplier: newMultiplier,
          streakReset: !streakAlive,
          windowClosesAt: monthlyClose,
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
      this.logger.error(
        `Failed to claim rakeback for user ${username}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Failed to claim rakeback');
    }
  }
}