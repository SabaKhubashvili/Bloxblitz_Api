import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../../cache/redis.service';
import { RedisKeys } from '../../../cache/redis.keys';
import { SeedRotationType } from '@prisma/client';
import * as crypto from 'crypto';
import { sha256HashServerSeed } from '../../../../domain/shared/provably-fair-hash';
import type {
  IProvablyFairDbPort,
  ProvablyFairDataFromDb,
} from '../../../../application/user/provably-fair/ports/provably-fair-db.port';

@Injectable()
export class PrismaProvablyFairRepository implements IProvablyFairDbPort {
  private readonly logger = new Logger(PrismaProvablyFairRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getProvablyFairData(
    username: string,
  ): Promise<ProvablyFairDataFromDb | null> {
    let userSeed = await this.prisma.userSeed.findUnique({
      where: { userUsername: username },
    });

    if (!userSeed) {
      userSeed = await this.ensureUserSeedExists(username);
      if (!userSeed) return null;
    }

    await this.performServerSeedRotationIfNeeded(username, userSeed);

    userSeed = await this.prisma.userSeed.findUnique({
      where: { userUsername: username },
    });
    if (!userSeed) return null;

    const nonceKey = RedisKeys.user.nonce(username);
    const cachedNonce = await this.redis.get(nonceKey);
    const totalGamesPlayed =
      cachedNonce !== null
        ? parseInt(cachedNonce, 10)
        : userSeed.totalGamesPlayed;
    const safeNonce = Number.isNaN(totalGamesPlayed)
      ? userSeed.totalGamesPlayed
      : totalGamesPlayed;

    return {
      clientSeed: userSeed.activeClientSeed,
      serverSeedHash: userSeed.activeServerSeedHash,
      nextServerSeedHash: userSeed.nextServerSeedHash,
      totalGamesPlayed: safeNonce,
    };
  }

  async rotateClientSeed(
    username: string,
    clientSeed?: string,
  ): Promise<
    | {
        success: boolean;
        clientSeed: string;
        serverSeedHash: string;
        nextServerSeedHash: string;
        totalGamesPlayed: number;
        activeGames?: string[];
      }
    | null
  > {
    let userSeed = await this.prisma.userSeed.findUnique({
      where: { userUsername: username },
    });

    if (!userSeed) {
      userSeed = await this.ensureUserSeedExists(username);
      if (!userSeed) return null;
    }

    const newClientSeed =
      clientSeed && clientSeed.trim().length > 0
        ? clientSeed.trim()
        : crypto.randomBytes(32).toString('hex');
    const nextServerSeed = crypto.randomBytes(32).toString('hex');
    const nextServerSeedHash = sha256HashServerSeed(nextServerSeed);

    const nonceKey = RedisKeys.user.nonce(username);

    await this.prisma.$transaction(async (tx) => {
      await tx.userSeed.update({
        where: { userUsername: username },
        data: {
          activeClientSeed: newClientSeed,
          activeServerSeedHash: userSeed.nextServerSeedHash,
          activeServerSeed: userSeed.nextServerSeed,
          nextServerSeed,
          nextServerSeedHash,
          totalGamesPlayed: 0,
          lastUsedAt: new Date(),
        },
      });
      const seedRotationHistory = await tx.seedRotationHistory.create({
        data: {
          userUsername: username,
          serverSeed: userSeed.activeServerSeed,
          serverSeedHash: userSeed.activeServerSeedHash,
          clientSeed: userSeed.activeClientSeed,
          totalGamesPlayed: userSeed.totalGamesPlayed,
          seedActivatedAt: userSeed.seedCreatedAt,
          rotationType: SeedRotationType.MANUAL,
          firstNonce: 1,
          lastNonce: userSeed.totalGamesPlayed,
          userSeedId: userSeed.id,
        },
      });
      await tx.gameHistory.updateMany({
        where: {
          username,
          seedRotationHistoryId: null,
        },
        data: { seedRotationHistoryId: seedRotationHistory.id },
      });
    });

    await this.redis.set(nonceKey, '0');
    await this.redis.del(RedisKeys.user.userSeed(username));

    const updated = await this.prisma.userSeed.findUnique({
      where: { userUsername: username },
      select: {
        activeServerSeedHash: true,
        nextServerSeedHash: true,
      },
    });

    return {
      success: true,
      clientSeed: newClientSeed,
      serverSeedHash: updated?.activeServerSeedHash ?? '',
      nextServerSeedHash: updated?.nextServerSeedHash ?? '',
      totalGamesPlayed: 0,
    };
  }

 async ensureUserSeedExists(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { client_seed: true },
    });
    if (!user) return null;

    const activeServerSeed = crypto.randomBytes(32).toString('hex');
    const activeServerSeedHash = sha256HashServerSeed(activeServerSeed);
    const nextServerSeed = crypto.randomBytes(32).toString('hex');
    const nextServerSeedHash = sha256HashServerSeed(nextServerSeed);

    const created = await this.prisma.userSeed.create({
      data: {
        userUsername: username,
        activeServerSeed,
        activeServerSeedHash,
        activeClientSeed: user.client_seed,
        nextServerSeed,
        nextServerSeedHash,
      },
    });
    await this.redis.del(RedisKeys.user.userSeed(username));
    return created;
  }

  /**
   * When totalGamesPlayed >= maxGamesPerSeed, rotate server seed:
   * 1. Create SeedRotationHistory with the OLD server seed (reveal)
   * 2. Link GameHistory rows (via MinesBetHistory nonce range) to it
   * 3. Promote nextServerSeed to active, generate new next
   */
  private async performServerSeedRotationIfNeeded(
    username: string,
    userSeed: { id: string; activeServerSeed: string; activeServerSeedHash: string; activeClientSeed: string; nextServerSeed: string; nextServerSeedHash: string; seedCreatedAt: Date; maxGamesPerSeed: number; totalGamesPlayed: number },
  ): Promise<void> {
    const nonceKey = RedisKeys.user.nonce(username);
    const cachedNonce = await this.redis.get(nonceKey);
    const totalGamesPlayed =
      cachedNonce !== null
        ? parseInt(cachedNonce, 10)
        : userSeed.totalGamesPlayed;

    if (totalGamesPlayed < userSeed.maxGamesPerSeed) return;

    const firstNonce = 1;
    const lastNonce = totalGamesPlayed;

    const seedRotationHistory = await this.prisma.seedRotationHistory.create({
      data: {
        userUsername: username,
        serverSeed: userSeed.activeServerSeed,
        serverSeedHash: sha256HashServerSeed(userSeed.activeServerSeed),
        clientSeed: userSeed.activeClientSeed,
        totalGamesPlayed: lastNonce - firstNonce + 1,
        seedActivatedAt: userSeed.seedCreatedAt,
        rotationType: SeedRotationType.AUTOMATIC,
        rotationReason: 'Server seed rotation - max games reached',
        userSeedId: userSeed.id,
        firstNonce,
        lastNonce,
      },
    });

    const minesBetHistories = await this.prisma.minesBetHistory.findMany({
      where: {
        userUsername: username,
        nonce: { gte: firstNonce, lte: lastNonce },
      },
      select: { gameId: true },
    });

    const gameIds = minesBetHistories.map((m) => m.gameId);
    if (gameIds.length > 0) {
      await this.prisma.gameHistory.updateMany({
        where: {
          id: { in: gameIds },
          username,
          seedRotationHistoryId: null,
        },
        data: { seedRotationHistoryId: seedRotationHistory.id },
      });
      this.logger.debug(
        `[ProvablyFair] Linked ${gameIds.length} GameHistory rows to SeedRotationHistory for ${username}`,
      );
    }

    const newServerSeed = crypto.randomBytes(32).toString('hex');
    const newServerSeedHash = sha256HashServerSeed(newServerSeed);

    await this.prisma.$transaction(async (tx) => {
      await tx.userSeed.update({
        where: { userUsername: username },
        data: {
          activeServerSeed: userSeed.nextServerSeed,
          activeServerSeedHash: sha256HashServerSeed(userSeed.nextServerSeed),
          nextServerSeed: newServerSeed,
          nextServerSeedHash: newServerSeedHash,
          totalGamesPlayed: 0,
          seedRotatedAt: new Date(),
          lastUsedAt: new Date(),
        },
      });
    });

    await this.redis.set(nonceKey, '0');
    await this.redis.del(RedisKeys.user.userSeed(username));
  }
}
