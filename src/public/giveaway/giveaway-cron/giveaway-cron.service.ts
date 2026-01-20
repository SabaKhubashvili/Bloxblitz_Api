import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class GiveawayCronService {
  private readonly logger = new Logger(GiveawayCronService.name);

  constructor(
    private prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  // Run every 10 minutes
  @Cron(CronExpression.EVERY_5_MINUTES, {
    name: 'selectGiveawayWinners',
  })
  async handleGiveawayWinnerSelection() {
    this.logger.log('Starting giveaway winner selection cron job');

    try {
      const now = new Date();

      // Find all ended giveaways without winners
      const endedGiveaways = await this.prisma.ampGiveaway.findMany({
        where: {
          isActive: true,
          endDate: {
            lte: now,
          },
          winnerUsername: null,
        },
        include: {
          ampGiveawayEntries: {
            select: {
              id: true,
              userUsername: true,
            },
          },
        },
      });

      this.logger.log(`Found ${endedGiveaways.length} giveaways to process`);

      const results: {
        giveawayId: number;
        status: string;
        winner?: string;
        totalEntries?: number;
        error?: string;
      }[] = [];

      for (const giveaway of endedGiveaways) {
        try {
          // No entries - mark as completed
          if (giveaway.ampGiveawayEntries.length === 0) {
            await this.prisma.ampGiveaway.update({
              where: { id: giveaway.id },
              data: { isActive: false },
            });

            results.push({
              giveawayId: giveaway.id,
              status: 'no_entries',
            });

            this.logger.warn(
              `Giveaway ${giveaway.id} completed with no entries`,
            );
            continue;
          }

          // Select random winner
          const winner = this.selectRandomWinner(giveaway.ampGiveawayEntries);
          this.logger.log(
            `Giveaway: ${giveaway.id}, was won by: ${winner.userUsername} `,
          );
          // Update giveaway with transaction for consistency

            await this.prisma.ampGiveaway.update({
              where: { id: giveaway.id },
              data: {
                winnerUsername: winner.userUsername,
                isActive: false,
              },
            }),

          results.push({
            giveawayId: giveaway.id,
            winner: winner.userUsername,
            totalEntries: giveaway.ampGiveawayEntries.length,
            status: 'success',
          });

          this.logger.log(
            `Winner selected for giveaway ${giveaway.id}: ${winner.userUsername} (${giveaway.ampGiveawayEntries.length} total entries)`,
          );

          // Optional: Send notification
          // await this.notifyWinner(winner.userUsername, giveaway);
        } catch (error) {
          this.logger.error(
            `Error processing giveaway ${giveaway.id}:`,
            error.stack,
          );
          results.push({
            giveawayId: giveaway.id,
            status: 'error',
            error: error.message,
          });
        }
      }

      this.logger.log(
        `Cron job completed. Processed: ${results.length} giveaways`,
      );

      return results;
    } catch (error) {
      this.logger.error('Cron job failed:', error.stack);
      throw error;
    }
  }
  // Alternative schedules you can use:

  // @Cron(CronExpression.EVERY_5_MINUTES)
  // @Cron(CronExpression.EVERY_30_MINUTES)
  // @Cron(CronExpression.EVERY_HOUR)
  // @Cron('*/5 * * * *') // Custom: every 5 minutes
  // @Cron('0 0 * * *') // Custom: daily at midnight

  // Run every 5 minutes for high-frequency checks
  @Cron('*/5 * * * *', {
    name: 'quickCheck',
  })
  async quickWinnerCheck() {
    // Only check giveaways ending in the next hour for better performance
    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    const endingSoon = await this.prisma.ampGiveaway.findMany({
      where: {
        isActive: true,
        endDate: {
          gte: now,
          lte: oneHourFromNow,
        },
      },
      select: { id: true, endDate: true },
    });

    if (endingSoon.length > 0) {
      this.logger.log(
        `${endingSoon.length} giveaways ending soon, monitoring closely`,
      );
    }
  }

  // Daily cleanup job
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'dailyCleanup',
  })
  async handleDailyCleanup() {
    this.logger.log('Running daily cleanup job');

    try {
      // Archive old completed giveaways
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const archived = await this.prisma.ampGiveaway.updateMany({
        where: {
          isActive: false,
          endDate: {
            lte: thirtyDaysAgo,
          },
        },
        data: {
          // Add archived field if you have it
          // archived: true,
        },
      });

      this.logger.log(`Archived ${archived.count} old giveaways`);
    } catch (error) {
      this.logger.error('Daily cleanup failed:', error.stack);
    }
  }

  // Helper method: Select random winner
  private selectRandomWinner<T>(entries: T[]): T {
    const randomIndex = Math.floor(Math.random() * entries.length);
    return entries[randomIndex];
  }

  // Helper method: Select weighted winner (if you have weights)
  private selectWeightedWinner(
    entries: Array<{ userUsername: string; weight: number }>,
  ): string {
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    let random = Math.random() * totalWeight;

    for (const entry of entries) {
      random -= entry.weight;
      if (random <= 0) {
        return entry.userUsername;
      }
    }

    return entries[entries.length - 1].userUsername;
  }

  // Optional: Manually trigger cron job
  triggerWinnerSelection() {
    this.logger.log('Manually triggering winner selection');
    return this.handleGiveawayWinnerSelection();
  }

  // Optional: Get cron job status
  getCronJobStatus() {
    const job = this.schedulerRegistry.getCronJob('selectGiveawayWinners');
    return {
      name: 'selectGiveawayWinners',
      lastDate: job.lastDate(),
      nextDate: job.nextDate(),
    };
  }

  // Optional: Stop cron job
  stopCronJob() {
    const job = this.schedulerRegistry.getCronJob('selectGiveawayWinners');
    job.stop();
    this.logger.warn('Cron job stopped');
  }

  // Optional: Start cron job
  startCronJob() {
    const job = this.schedulerRegistry.getCronJob('selectGiveawayWinners');
    job.start();
    this.logger.log('Cron job started');
  }
}
