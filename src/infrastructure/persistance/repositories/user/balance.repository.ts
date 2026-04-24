import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../../cache/redis.service';
import { RedisKeys } from '../../../cache/redis.keys';
import type {
  IBalanceRepository,
  UserBalanceRecord,
} from '../../../../domain/user/ports/balance.repository.port';

/**
 * Implements IBalanceRepository with a two-tier read strategy:
 *
 *  Tier 1 — Game-engine Redis key ("user:balance:{u}")
 *    The game engine stores the authoritative, real-time coin balance here.
 *    Reads from Redis are <1 ms and reflect the last bet/cashout without
 *    waiting for the 1-second BalanceSyncWorker to flush to PostgreSQL.
 *
 *  Tier 2 — PostgreSQL (via Prisma)
 *    Used when the Redis key is absent (e.g., first-time login before any game).
 *    The User.balance column holds the last synced value, which may be up to
 *    ~1 second behind the live Redis value.
 *
 * The pet-value balance ("user:valueBalance:{u}") follows the same pattern:
 * Redis first, zero fallback if the key has not been populated yet.
 * Inventory aggregation from the DB is intentionally avoided on the hot path —
 * it requires a JOIN and aggregate over potentially large inventory sets.
 */
@Injectable()
export class PrismaBalanceRepository implements IBalanceRepository {
  private readonly logger = new Logger(PrismaBalanceRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async findBalanceByUsername(
    username: string,
  ): Promise<UserBalanceRecord | null> {
    // ── Tier 1: game-engine live Redis keys ─────────────────────────────────
    const [rawBalance, rawPetValue] = await this.tryRedisRead(username);

    if (rawBalance !== null && rawPetValue !== null) {
      this.logger.debug(
        `[BalanceRepo] Redis hit for ${username}: balance=${rawBalance}`,
      );
      return {
        balance: this.parseDecimal(rawBalance),
        petValueBalance:
          rawPetValue !== null ? this.parseDecimal(rawPetValue) : 0,
      };
    }

    // ── Tier 2: PostgreSQL fallback ──────────────────────────────────────────
    this.logger.debug(
      `[BalanceRepo] Redis miss for ${username}, querying PostgreSQL`,
    );

    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { balance: true },
    });

    if (!user) {
      return null;
    }
    const petValue = await this.prisma.userInventoryAmp.aggregate({
      where: {
        userUsername: username,
      },
      _sum: {
        value: true,
      },
    });

    // Pet-value balance is Redis-only on the hot path.
    // If the key is absent (no inventory yet), we return 0 rather than running
    // a potentially expensive inventory aggregate query on every balance read.
    const petValueBalance = petValue._sum.value
      ? this.parseDecimal(petValue._sum.value.toString())
      : 0;

    return {
      balance: user.balance.toNumber(),
      petValueBalance,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Fetches both Redis balance keys in a single MGET round-trip.
   * Returns [rawBalance, rawPetValue] — each is a string or null.
   */
  private async tryRedisRead(
    username: string,
  ): Promise<[string | null, string | null]> {
    try {
      const keys = [
        RedisKeys.user.balance.user(username),
        RedisKeys.user.balance.petValue(username),
      ];
      const [rawBalance, rawPetValue] = await this.redis.mget(keys);
      return [rawBalance ?? null, rawPetValue ?? null];
    } catch (err) {
      this.logger.warn(
        `[BalanceRepo] Redis MGET failed for ${username}, falling back to DB`,
        err,
      );
      return [null, null];
    }
  }

  /** Parses a Redis string to a number rounded to 2 decimal places. */
  private parseDecimal(raw: string): number {
    const n = parseFloat(raw);
    return isNaN(n) ? 0 : Math.round(n * 100) / 100;
  }
}
