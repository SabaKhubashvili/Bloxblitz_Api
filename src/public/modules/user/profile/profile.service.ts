import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';
import { LevelingService } from '../../leveling/leveling.service';

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly levelingService: LevelingService
  ) {}
  private readonly USER_PROFILE_CACHE_TTL = 300; // 5 minutes
  private readonly USER_RANK_CACHE_TTL = 60; // 1 minute (ranks change more frequently)

  async getProfile(username: string) {
    try {
      const cachedProfile = await this.redisService.get(
        RedisKeys.user.profile(username),
      );
      if (cachedProfile) {
        return cachedProfile;
      }

      // Calculate date boundaries for 7 and 30 days ago
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const user = await this.prisma.user.findUnique({
        where: { username },
        select: {
          id: true,
          username: true,
          currentLevel: true,
          totalXP: true,
          profile_picture: true,
          created_at: true,
          statistics: {
            select: {
              totalWagered: true,
              totalWithdrawals: true,
              totalDeposits: true,
              totalProfit: true,
              totalLoss: true,
            },
          },
          
          settings: {
            select: {
              privateProfile: true,
            },
          },
        },
      });

      if (!user) {
        throw new BadRequestException('User not found.');
      }

      // Calculate wagers for past 7 and 30 days
      const [wagerLast7Days, wagerLast30Days] = await Promise.all([
        this.prisma.gameHistory.aggregate({
          where: {
            username: username,
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
          _sum: {
            betAmount: true,
          },
        }),
        this.prisma.gameHistory.aggregate({
          where: {
            username: username,
            createdAt: {
              gte: thirtyDaysAgo,
            },
          },
          _sum: {
            betAmount: true,
          },
        }),
      ]);
      const xpLeftForNextLevel = this.levelingService.getXpProgress(user.totalXP);
      const profileData = {
        ...user,
        statistics: {
          ...user.statistics,
          wagerLast7Days: wagerLast7Days._sum.betAmount?.toNumber() || 0,
          wagerLast30Days: wagerLast30Days._sum.betAmount?.toNumber() || 0,
        },
        totalXp:xpLeftForNextLevel.totalXp,
        currentLevel: xpLeftForNextLevel.currentLevel,
        xpNeededForNextLevel: xpLeftForNextLevel.xpNeededForNextLevel,
        xpPercentage: xpLeftForNextLevel.progressPercentage,
      };

      await this.redisService.mainClient.setEx(
        RedisKeys.user.profile(username),
        3600,
        JSON.stringify(profileData),
      );

      return profileData;
    } catch (err) {
      this.logger.error(
        `Error fetching profile for ${username}: ${err.message}`,
      );
      if (err instanceof BadRequestException) {
        throw err;
      }
      const message = 'An error occurred while fetching profile data.';
      throw new InternalServerErrorException(message);
    }
  }

  async setPrivateProfile(username: string, newVal: boolean) {
    try {
      const newPrivateProfileSetting = newVal;

      const updateRes = await this.prisma.userSettings.update({
        where: { userUsername: username },
        data: { privateProfile: newPrivateProfileSetting },
      });
      if (!updateRes) {
        throw new BadRequestException(
          'Failed to update private profile setting.',
        );
      }

      // Invalidate cached profile
      await this.redisService.mainClient.del(RedisKeys.user.profile(username));

      return { privateProfile: newPrivateProfileSetting };
    } catch (err) {
      this.logger.error(
        `Error updating private profile for ${username}: ${err.message}`,
      );
      if (err instanceof BadRequestException) {
        throw err;
      }
      const message =
        'An error occurred while updating private profile setting.';
      throw new InternalServerErrorException(message);
    }
  }

  async getUserProfileWithRank(username: string) {
    const isPrivate = await this.prisma.userSettings.findUnique({
      where: { userUsername: username },
      select: { privateProfile: true },
    });

    const cacheKey = RedisKeys.user.publicProfile(username);

    // Try to get from cache first
    const cached: {
      username: string;
      role: string;
      currentLevel: number;
      totalXP: number;
      profile_picture: string;
      created_at: Date;
      statistics: {
        totalWagered: number;
        totalGamesWon: number;
        biggestWin: number;
        totalGamesPlayed: number;
      };
      leaderboardRank: number;
      winRate: number;
      isOnline: boolean;
      privateProfile: boolean;
    } | null = await this.redisService.get(cacheKey);
    if (cached) {
      if (isPrivate?.privateProfile) {
        const {
          statistics,
          totalXP,
          currentLevel,
          role,
          created_at,
          leaderboardRank,
          isOnline,
          winRate,
          ...returnable
        } = cached;
        return { ...returnable, privateProfile: true };
      }
      const isOnline = await this.checkUserOnlineStatus(username);
      return { ...cached, isOnline };
    }

    // If not in cache, query database
    const result = await this.prisma.$queryRaw<
      Array<{
        id: string;
        username: string;
        role: string;
        currentLevel: number;
        totalXP: number;
        profile_picture: string;
        created_at: Date;
        totalWagered: Decimal;
        totalGamesWon: number;
        biggestWin: Decimal;
        totalGamesPlayed: number;
        rank: bigint;
      }>
    >`
      WITH ranked_users AS (
        SELECT 
          u.id,
          u.username,
          u.role,
          u."currentLevel",
          u."totalXP",
          u.profile_picture,
          u.created_at,
          s."totalWagered",
          s."totalGamesWon",
          s."biggestWin",
          s."totalGamesPlayed",
          DENSE_RANK() OVER (ORDER BY s."totalWagered" DESC) as rank
        FROM "User" u
        INNER JOIN "UserStatistics" s ON s."userUsername" = u.username
      )
      SELECT * FROM ranked_users
      WHERE username = ${username}
    `;

    if (!result || result.length === 0) {
      throw new NotFoundException('User not found');
    }

    const user = result[0];

    // Calculate win rate
    const winRate = user.totalGamesPlayed
      ? Number(((user.totalGamesWon / user.totalGamesPlayed) * 100).toFixed(1))
      : 0;
    const levelInfo = await this.levelingService.getUserLevelInfo(username);
    // Format response
    const response = {
      username: user.username,
      role: user.role,
      currentLevel: levelInfo.currentLevel,
      totalXP: levelInfo.totalXp,
      progressPercentage: levelInfo.progressPercentage,
      xpNeededForNextLevel: levelInfo.xpNeededForNextLevel,
      profile_picture: user.profile_picture,
      created_at: user.created_at,
      statistics: {
        totalWagered: user.totalWagered.toNumber(),
        totalGamesWon: user.totalGamesWon,
        biggestWin: user.biggestWin.toNumber(),
        totalGamesPlayed: user.totalGamesPlayed,
      },
      leaderboardRank: Number(user.rank),
      winRate,
      isOnline: await this.checkUserOnlineStatus(user.username),
      privateProfile: false,
    };
    await this.redisService.mainClient.setEx(
      cacheKey,
      this.USER_PROFILE_CACHE_TTL,
      JSON.stringify(response),
    );
    if (isPrivate?.privateProfile) {
      const {
        statistics,
        totalXP,
        currentLevel,
        role,
        created_at,
        leaderboardRank,
        isOnline,
        winRate,
        ...returnable
      } = response;
      return { ...returnable, privateProfile: true };
    }
    // Cache the result

    return response;
  }

  /**
   * Invalidate user cache when their stats are updated
   */
  async invalidateUserCache(username: string) {
    const cacheKey = RedisKeys.user.publicProfile(username);
    await this.redisService.del(cacheKey);
  }

  /**
   * Optional: Check if user is online (using Redis presence)
   */
  private async checkUserOnlineStatus(username: string): Promise<boolean> {
    const onlineKey = RedisKeys.user.online(username);
    const isOnline = await this.redisService.get(onlineKey);
    return !!isOnline;
  }

  /**
   * Get top leaderboard with caching
   */
  async getTopLeaderboard(limit: number = 100) {
    const cacheKey = `leaderboard:top:${limit}`;

    // Try cache first
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Query database
    const result = await this.prisma.$queryRaw<
      Array<{
        id: string;
        username: string;
        role: string;
        currentLevel: number;
        totalXP: number;
        profile_picture: string;
        totalWagered: Decimal;
        totalGamesWon: number;
        totalGamesPlayed: number;
        rank: bigint;
      }>
    >`
      WITH ranked_users AS (
        SELECT 
          u.id,
          u.username,
          u.role,
          u."currentLevel",
          u."totalXP",
          u.profile_picture,
          s."totalWagered",
          s."totalGamesWon",
          s."totalGamesPlayed",
          DENSE_RANK() OVER (ORDER BY s."totalWagered" DESC) as rank
        FROM "User" u
        INNER JOIN "Statistics" s ON s."userUsername" = u.username
      )
      SELECT * FROM ranked_users
      WHERE rank <= ${limit}
      ORDER BY rank ASC
    `;

    const formattedResult = result.map((user) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      currentLevel: user.currentLevel,
      totalXP: user.totalXP,
      profile_picture: user.profile_picture,
      totalWagered: user.totalWagered.toString(),
      totalGamesWon: user.totalGamesWon,
      totalGamesPlayed: user.totalGamesPlayed,
      rank: Number(user.rank),
      winRate: user.totalGamesPlayed
        ? Number(
            ((user.totalGamesWon / user.totalGamesPlayed) * 100).toFixed(1),
          )
        : 0,
    }));

    // Cache for shorter time since leaderboard changes frequently
    await this.redisService.mainClient.setEx(
      cacheKey,
      this.USER_RANK_CACHE_TTL,
      JSON.stringify(formattedResult),
    );

    return formattedResult;
  }
}
