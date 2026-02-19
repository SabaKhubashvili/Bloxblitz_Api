import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/provider/redis/redis.service';
import { TimedOutDataInterface } from './interface/TimedOut.interface';
import { BannedData } from './interface/BannedData.interface';
import { GameType, UserRoles } from '@prisma/client';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { LevelingService } from 'src/public/modules/leveling/leveling.service';

@Injectable()
export class PrivateUserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
    private readonly levelingService: LevelingService,
  ) {}

  async getUserRole(
    username: string,
  ): Promise<{ username: string; role: string }> {
    const userRole = await this.prismaService.user.findUnique({
      where: { username },
      select: { role: true },
    });

    if (userRole) {
      return { username, role: userRole.role };
    } else {
      throw new NotFoundException('User not found');
    }
  }
  async getUserInfoByUsername(username: string) {
    const user = await this.prismaService.user.findUnique({
      where: { username },
      select: {
        last_login_ip: true,
        role: true,
        statistics: {
          select: {
            totalWagered: true,
            coinflipsWon: true,
            biggestWin: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const [bannedData, timedOutData] = await Promise.all([
      this.getBanStatus(username),
      this.getTimeoutStatus(username),
    ]);

    const possibleAlts = await this.getPossibleAlts(user);

    const canChat = !bannedData && !timedOutData?.isTimedOut;

    return {
      canChat,
      statusMessage:
        bannedData?.message ||
        (timedOutData?.isTimedOut ? timedOutData.message : ''),
      bannedData,
      timedOutData,
      statistics: user.statistics ?? {
        totalWagered: 0,
        coinflipsWon: 0,
        biggestWin: 0,
      },
      possibleAlts,
    };
  }
  private async getBanStatus(username: string): Promise<BannedData | null> {
    const raw = await this.redisService.mainClient.get(RedisKeys.chat.bans());

    if (!raw) return null;

    const bannedUsers: any[] = JSON.parse(raw);
    const bannedUser = bannedUsers.find((u) => u.username === username);

    if (!bannedUser) return null;

    const banDate = new Date(bannedUser.timestamp).toLocaleString();

    return {
      isBanned: true,
      canChat: false,
      bannedBy: bannedUser.bannedBy,
      reason: bannedUser.reason,
      banDate,
      message: `You are banned by ${bannedUser.bannedBy}\nReason: ${bannedUser.reason}\nBan date: ${banDate}`,
    };
  }
  private async getTimeoutStatus(
    username: string,
  ): Promise<TimedOutDataInterface | null> {
    const raw = await this.redisService.mainClient.get(
      RedisKeys.chat.timeouts(),
    );

    if (!raw) return null;

    const timedOutUsers: any[] = JSON.parse(raw);
    const entry = timedOutUsers.find((u) => u.username === username);

    if (!entry) return null;

    const expiration = new Date(entry.expiration);
    if (expiration <= new Date()) {
      return {
        isTimedOut: false,
        canChat: true,
        message: '',
      };
    }

    const remainingMs = expiration.getTime() - Date.now();
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);

    const timeLeft = `${minutes}m ${seconds.toString().padStart(2, '0')}s`;

    return {
      isTimedOut: true,
      canChat: false,
      expiration: expiration.toISOString(),
      mutedBy: entry.mutedBy,
      reason: entry.reason,
      timeLeft,
      message: `You are timed out for ${timeLeft}\nReason: ${entry.reason}\nMuted by: ${entry.mutedBy}`,
    };
  }

  private async getPossibleAlts(user: {
    last_login_ip: string | null;
    role: UserRoles;
  }) {
    if (
      !user.last_login_ip ||
      [UserRoles.ADMIN, UserRoles.OWNER, UserRoles.COMMUNITY_MANAGER].includes(
        user.role as any,
      )
    ) {
      return [];
    }

    const alts = await this.prismaService.user.findMany({
      where: {
        last_login_ip: user.last_login_ip,
        role: {
          notIn: [UserRoles.OWNER, UserRoles.COMMUNITY_MANAGER],
        },
      },
      select: {
        username: true,
        role: true,
      },
    });

    return alts;
  }
  async getUserLastLoginIp(username: string) {
    const user = await this.prismaService.user.findUnique({
      where: { username },
      select: { last_login_ip: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { username, lastLoginIp: user.last_login_ip };
  }
  async addUserXp(username: string, wageredAmount: number, gameType: GameType) {
    const newXp = await this.levelingService.awardXpFromWager(
      username,
      wageredAmount,
      gameType,
    );
    return { username, newXp };
  }
  async getUserXp(username: string) {
    const userLevelInfo = await this.levelingService.getUserLevelInfo(username);
    return { username, ...userLevelInfo };
  }
}
