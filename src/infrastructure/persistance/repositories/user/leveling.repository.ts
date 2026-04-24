import { Injectable, Logger } from '@nestjs/common';
import type { XpSource as PrismaXpSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { ILevelingRepository } from '../../../../domain/leveling/ports/leveling.repository.port';
import type {
  LevelProgress,
  XpEventRecord,
} from '../../../../domain/leveling/entities/level-progress.entity';
import { LevelProgressMapper } from '../../../../application/user/leveling/mappers/level-progress.mapper';

/**
 * Prisma implementation of ILevelingRepository.
 *
 * Level data is stored on the User model (totalXP, currentLevel, xpMultiplier)
 * rather than in a dedicated table — no JOIN required for the hot-path read.
 *
 * XP events are appended to the XpEvent audit table.
 */
@Injectable()
export class PrismaLevelingRepository implements ILevelingRepository {
  private readonly logger = new Logger(PrismaLevelingRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(username: string): Promise<LevelProgress | null> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        totalXP: true,
        currentLevel: true,
        xpMultiplier: true,
      },
    });

    if (!user) return null;

    return LevelProgressMapper.toDomain({
      username: user.username,
      totalXP: user.totalXP,
      currentLevel: user.currentLevel,
      xpMultiplier: user.xpMultiplier.toNumber(),
    });
  }

  async save(levelProgress: LevelProgress): Promise<void> {
    await this.persist(levelProgress);
  }

  async update(levelProgress: LevelProgress): Promise<void> {
    await this.persist(levelProgress);
  }

  async logXpEvent(event: XpEventRecord): Promise<void> {
    try {
      await this.prisma.xpEvent.create({
        data: {
          userUsername: event.username,
          amount: event.amount,
          source: event.source as PrismaXpSource,
          referenceId: event.referenceId ?? null,
        },
      });
    } catch (err) {
      // XP event logging is non-critical — log and continue rather than failing
      // the parent transaction.
      this.logger.error(
        `[LevelingRepo] Failed to log XP event for ${event.username}`,
        err,
      );
    }
  }

  async sumXpSince(username: string, since: Date): Promise<number> {
    const result = await this.prisma.xpEvent.aggregate({
      where: {
        userUsername: username,
        createdAt: { gte: since },
      },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async persist(levelProgress: LevelProgress): Promise<void> {
    await this.prisma.user.update({
      where: { username: levelProgress.username },
      data: {
        totalXP: levelProgress.totalXp,
        currentLevel: levelProgress.currentLevel,
      },
    });
  }
}
