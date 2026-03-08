import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IProfileRepository,
  UserProfileRecord,
} from '../../../../domain/user/ports/profile.repository.port';

@Injectable()
export class PrismaProfileRepository implements IProfileRepository {
  private readonly logger = new Logger(PrismaProfileRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string): Promise<UserProfileRecord | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        profile_picture: true,
        created_at: true,
        totalXP: true,
        currentLevel: true,
        statistics: {
          select: {
            totalDeposits: true,
            totalWithdrawals: true,
            totalProfit: true,
            totalLoss: true,
            totalWagered: true,
          },
        },
        settings: {
          select: {
            privateProfile: true,
          },
        },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      profile_picture: user.profile_picture,
      created_at: user.created_at,
      totalXP: user.totalXP,
      currentLevel: user.currentLevel,
      statistics: user.statistics,
      settings: user.settings,
    };
  }

  async updatePrivateProfile(
    username: string,
    privateProfile: boolean,
  ): Promise<{ privateProfile: boolean }> {
    const result = await this.prisma.userSettings.upsert({
      where: { userUsername: username },
      update: { privateProfile },
      create: { userUsername: username, privateProfile },
      select: { privateProfile: true },
    });

    return { privateProfile: result.privateProfile };
  }

  async sumWagerSince(username: string, since: Date): Promise<number> {
    try {
      const result = await this.prisma.gameHistory.aggregate({
        where: {
          username,
          createdAt: { gte: since },
        },
        _sum: { betAmount: true },
      });

      return result._sum.betAmount?.toNumber() ?? 0;
    } catch (err) {
      this.logger.warn(
        `[ProfileRepo] sumWagerSince failed for ${username}`,
        err,
      );
      return 0;
    }
  }
}
