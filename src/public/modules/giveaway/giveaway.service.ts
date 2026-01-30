import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';
import { AddNewGiveawayDto } from './dto/add-new-giveaway.dto';
import { Variant } from '@prisma/client';
import { OptionalAuthenticatedRequest } from 'src/middleware/JWTOptionalGuard.middleawre';
import { GiveawayResult } from './result/giveaway-query.result';

interface CachedGiveaway {
  id: number;
  Variant: Variant[];
  endDate: Date;
  minWager: number;
  winnerUsername: string | null;
  petName: string;
  petImage: string;
  totalEntries: number;
}

@Injectable()
export class GiveawayService {
  private readonly logger = new Logger(GiveawayService.name);
  private readonly GIVEAWAY_CACHE_TTL = 300;
  private readonly USER_JOINED_CACHE_TTL = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getActiveGiveaways(
    user: OptionalAuthenticatedRequest['user'],
  ): Promise<GiveawayResult[]> {
    try {
      const cachedGiveaways = await this.redis.mainClient.get(
        RedisKeys.giveaway.getState(),
      );

      let giveaways: CachedGiveaway[];

      if (cachedGiveaways) {
        giveaways = JSON.parse(cachedGiveaways);
      } else {
        giveaways = await this.prisma.$queryRaw<CachedGiveaway[]>`
          SELECT 
            g.id,
            g."Variant",
            g."endDate",
            g."minWager",
            g."winnerUsername",
            p.name as "petName",
            p.image AS "petImage",
            COUNT(e.id)::int AS "totalEntries"
          FROM "AmpGiveaway" g
          LEFT JOIN "pets" p ON g."petId" = p.id
          LEFT JOIN "AmpGiveawayEntry" e ON e."giveawayId" = g.id
          WHERE g."endDate" >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}
          GROUP BY g.id, p.name, p.image
          ORDER BY 
            CASE 
              WHEN g."isActive" = true AND g."endDate" > NOW() THEN 0
              ELSE 1
            END,
            g."value" DESC
        `;
        this.logger.log("Fetched giveaways from DB and caching them.", JSON.stringify(giveaways));

        await this.redis.mainClient.setEx(
          RedisKeys.giveaway.getState(),
          this.GIVEAWAY_CACHE_TTL,
          JSON.stringify(giveaways),
        );
      }

      if (user?.username) {
        return await this.enrichWithUserData(giveaways, user.username);
      }

      return giveaways.map((giveaway) => ({
        ...giveaway,
        userJoined: 0,
      }));
    } catch (err) {
      this.logger.error(
        'Failed to get active giveaways',
        JSON.stringify(err instanceof Error ? err.stack : err),
      );

      if (err instanceof BadRequestException) {
        throw err;
      }

      throw new InternalServerErrorException('Failed to retrieve giveaways');
    }
  }

  private async enrichWithUserData(
    giveaways: CachedGiveaway[],
    username: string,
  ): Promise<GiveawayResult[]> {
    const giveawayIds = giveaways.map((g) => g.id);

    // Try to get user's joined giveaways from cache
    const cacheKey = RedisKeys.giveaway.userJoined(username);
    const cachedUserJoined = await this.redis.mainClient.get(cacheKey);

    let userJoinedMap: Map<number, number>;

    if (cachedUserJoined) {
      // Parse cached data
      const parsed = JSON.parse(cachedUserJoined);
      userJoinedMap = new Map(
        Object.entries(parsed).map(([k, v]) => [Number(k), v as number]),
      );
    } else {
      // Fetch user's entries for all active giveaways
      const userEntries = await this.prisma.$queryRaw<
        { giveawayId: number; count: number }[]
      >`
        SELECT 
          "giveawayId",
          COUNT(*)::int as count
        FROM "AmpGiveawayEntry"
        WHERE "userUsername" = ${username}
          AND "giveawayId" = ANY(${giveawayIds})
        GROUP BY "giveawayId"
      `;

      userJoinedMap = new Map(
        userEntries.map((entry) => [entry.giveawayId, entry.count]),
      );

      // Cache user's joined data
      const cacheData = Object.fromEntries(userJoinedMap);
      await this.redis.mainClient.setEx(
        cacheKey,
        this.USER_JOINED_CACHE_TTL,
        JSON.stringify(cacheData),
      );
    }

    // Merge user data with giveaway data
    return giveaways.map((giveaway) => ({
      ...giveaway,
      userJoined: userJoinedMap.get(giveaway.id) || 0,
    }));
  }

  async addGiveaway(data: AddNewGiveawayDto) {
    try {
      await this.prisma.ampGiveaway.create({
        data: {
          petId: data.petId,
          value: data.value,
          endDate: data.endDate,
          minWager: data.minWager || 0,
          Variant: data.variant,
        },
      });

      // Invalidate giveaway cache
      await this.redis.mainClient.del(RedisKeys.giveaway.getState());
    } catch (err) {
      this.logger.error(
        'Failed to add active giveaway',
        JSON.stringify(err instanceof Error ? err.stack : err),
      );

      if (err instanceof BadRequestException) {
        throw err;
      }

      throw new InternalServerErrorException('Failed to add giveaway');
    }
  }
  async joinGiveaway(username: string, giveawayId: number) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { username },
        select: { last_login_ip: true },
      });

      if (!user || !user.last_login_ip) {
        throw new BadRequestException('Unable to verify user identity');
      }

      const ipCheck = await this.prisma.$queryRaw<
        { hasAltWithEntry: bigint }[]
      >`
        SELECT COUNT(DISTINCT e.id) AS "hasAltWithEntry"
        FROM "User" u
        INNER JOIN "AmpGiveawayEntry" e ON e."userUsername" = u.username
        WHERE u."last_login_ip" = ${user.last_login_ip}
          AND u.username != ${username}
          AND e."giveawayId" = ${giveawayId}
        LIMIT 1
      `;

      if (ipCheck.length > 0 && Number(ipCheck[0].hasAltWithEntry) > 0) {
        throw new BadRequestException(
          'You are not allowed to join this giveaway due to alt account restrictions',
        );
      }

      const result = await this.prisma.$queryRaw<
        {
          giveawayExists: number;
          isActive: boolean;
          endDate: Date | null;
          minWager: number;
          userEntries: bigint;
          createdAt: Date;
          totalWager: string;
        }[]
      >`
        SELECT 
          CASE WHEN g.id IS NOT NULL THEN 1 ELSE 0 END AS "giveawayExists",
          COALESCE(g."isActive", false) AS "isActive",
          g."endDate" AS "endDate",
          COALESCE(g."minWager", 0) AS "minWager",
          COALESCE(COUNT(DISTINCT e.id), 0) AS "userEntries",
          g."created_at" AS "createdAt",
          COALESCE(
            (SELECT SUM(c."betAmount") / 2
             FROM "CoinflipGameHistory" c
             WHERE c."createdAt" >= g."created_at"
               AND (c."player1Username" = ${username} OR c."player2Username" = ${username})
            ), 0
          ) AS "totalWager"
        FROM "AmpGiveaway" g
        LEFT JOIN "AmpGiveawayEntry" e 
          ON e."giveawayId" = g.id
          AND e."userUsername" = ${username}
        WHERE g.id = ${giveawayId}
        GROUP BY g.id
        LIMIT 1
      `;

      if (result.length === 0 || result[0].giveawayExists === 0) {
        throw new BadRequestException('Giveaway not found');
      }

      const data = result[0];

      // Validate giveaway status
      if (!data.isActive) {
        throw new BadRequestException('This giveaway is no longer active');
      }

      if (data.endDate && new Date() > new Date(data.endDate)) {
        throw new BadRequestException('This giveaway has ended');
      }

      if (Number(data.userEntries) >= 1) {
        throw new BadRequestException('You have already joined this giveaway');
      }

      // Check minimum wager requirement
      const totalWager = Number(data.totalWager);
      if (totalWager < data.minWager) {
        throw new BadRequestException(
          `Insufficient wager to join the giveaway, you need ${
            data.minWager - totalWager
          } more to join`,
        );
      }

      // Create entry
      await this.prisma.ampGiveawayEntry.create({
        data: {
          giveawayId,
          userUsername: username,
        },
      });

      // Invalidate user's joined cache
      await this.invalidateUserJoinedCache(username);

      return {
        success: true,
        message: 'Successfully joined the giveaway',
        giveawayId,
      };
    } catch (err) {
      this.logger.error(
        `Failed to join giveaway for user ${username}`,
        JSON.stringify(err instanceof Error ? err.stack : err),
      );

      if (err instanceof BadRequestException) {
        throw err;
      }

      // Handle unique constraint violation (user already joined)
      if (err?.code === 'P2002') {
        throw new BadRequestException('You have already joined this giveaway');
      }

      throw new InternalServerErrorException('Failed to join giveaway');
    }
  }

  async invalidateUserJoinedCache(username: string) {
    try {
      const cacheKey = RedisKeys.giveaway.userJoined(username);
      this.logger.log(`Invalidating user joined cache for ${username} at key ${cacheKey}`);
      await this.redis.mainClient.del(cacheKey);
      this.logger.log(`Successfully invalidated user joined cache for ${username}`);
    } catch (err) {
      this.logger.warn(
        `Failed to invalidate user joined cache for ${username}`,
        err,
      );
    }
  }
}
