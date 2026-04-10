import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { RestrictionTimeframe } from '@prisma/client';
import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../persistance/prisma/prisma.service';

/**
 * On main API startup, hydrate Redis restriction keys from Postgres so WS can stay DB-free.
 */
@Injectable()
export class RouletteRestrictionBootstrapService implements OnModuleInit {
  private readonly log = new Logger(RouletteRestrictionBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const rows = await this.prisma.roulettePlayerRestriction.findMany();
      for (const row of rows) {
        const payload = {
          banned: row.isBanned,
          banReason: row.banReason,
          maxWagerAmount: row.maxWagerAmount,
          timeframe: row.timeframe,
        };
        await this.redis.mainClient.set(
          `roulette:restriction:${row.userUsername}`,
          JSON.stringify(payload),
        );

        const hasLimit =
          row.maxWagerAmount != null &&
          row.maxWagerAmount > 0 &&
          row.timeframe != null;
        if (!hasLimit) {
          const tfs: RestrictionTimeframe[] = ['HOURLY', 'DAILY', 'WEEKLY'];
          const keys = tfs.map(
            (tf) => `roulette:wager:${row.userUsername}:${tf}`,
          );
          if (keys.length > 0) {
            await this.redis.mainClient.del(keys);
          }
        }
      }
      this.log.log(
        `Roulette restrictions: synced ${rows.length} row(s) from DB → Redis.`,
      );
    } catch (e) {
      this.log.warn(
        `Roulette restriction bootstrap skipped: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
