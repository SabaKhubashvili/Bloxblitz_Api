// src/leveling/leveling.service.ts

import { Injectable, Logger } from '@nestjs/common';
import { LEVELING_CONFIG, XP_PER_DOLLAR } from './constants/leveling.constants';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/client';
import { LevelUpEvent } from './events/level-up.event';
import { GameType } from '@prisma/client';

@Injectable()
export class LevelingService {
  private readonly logger = new Logger(LevelingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Calculate XP required to reach a specific level
   */
  getXpForLevel(level: number): number {
    if (level <= 1) return 0;
    return Math.floor(
      LEVELING_CONFIG.BASE_XP * Math.pow(level - 1, LEVELING_CONFIG.EXPONENT),
    );
  }

  /**
   * Calculate total cumulative XP needed to reach a level
   */
  getTotalXpForLevel(level: number): number {
    if (level <= 1) return 0;
    
    let total = 0;
    for (let i = 1; i < level; i++) {
      total += this.getXpForLevel(i + 1);
    }
    return total;
  }

  /**
   * Calculate current level from total XP
   */
  getLevelFromXp(totalXp: number): number {
    if (totalXp < 0) return 1;

    let level = 1;
    let xpForNextLevel = this.getXpForLevel(level + 1);
    let cumulativeXp = 0;

    while (cumulativeXp + xpForNextLevel <= totalXp) {
      cumulativeXp += xpForNextLevel;
      level++;
      xpForNextLevel = this.getXpForLevel(level + 1);
    }

    return level;
  }

  /**
   * Get XP progress within current level
   */
  getXpProgress(totalXp: number) {
    const currentLevel = this.getLevelFromXp(totalXp);
    const xpForCurrentLevel = this.getTotalXpForLevel(currentLevel);
    const xpInCurrentLevel = totalXp - xpForCurrentLevel;
    const xpNeededForNextLevel = this.getXpForLevel(currentLevel + 1);
    const progressPercentage = Math.min(
      100,
      (xpInCurrentLevel / xpNeededForNextLevel) * 100,
    );

    return {
      currentLevel,
      xpInCurrentLevel,
      xpNeededForNextLevel,
      progressPercentage: Math.round(progressPercentage * 100) / 100,
      totalXp,
    };
  }

  /**
   * Calculate XP to award based on wager amount
   */
  calculateXpFromWager(
    wagerAmount: number | Decimal,
    gameType: string = 'COINFLIP',
    userMultiplier: number | Decimal = 1.0,
  ): number {
    const wager = typeof wagerAmount === 'number' 
      ? wagerAmount 
      : parseFloat(wagerAmount.toString());
    
    const multiplier = typeof userMultiplier === 'number'
      ? userMultiplier
      : parseFloat(userMultiplier.toString());

    const gameRate = LEVELING_CONFIG.XP_RATES[gameType] || 1.0;
    const baseXp = Math.floor(wager * XP_PER_DOLLAR * gameRate);
    
    return Math.floor(baseXp * multiplier);
  }

  /**
   * Award XP to a user and handle level-ups
   */
  async awardXp(
    username: string,
    xpAmount: number,
    source: string = 'WAGER',
  ): Promise<{
    xpAwarded: number;
    newLevel: number;
    leveledUp: boolean;
    levelsGained: number;
    rewards?: any;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        totalXP: true,
        currentLevel: true,
        xpMultiplier: true,
        balance: true,
      },
    });

    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    const oldLevel = user.currentLevel;
    const newTotalXp = user.totalXP + xpAmount;
    const newLevel = this.getLevelFromXp(newTotalXp);
    const leveledUp = newLevel > oldLevel;
    const levelsGained = newLevel - oldLevel;

    // Update user XP and level
    await this.prisma.user.update({
      where: { username },
      data: {
        totalXP: newTotalXp,
        currentLevel: newLevel,
      },
    });

    // Handle level-up rewards
    let rewards:any = null;
    if (leveledUp) {
      this.logger.log(
        `User ${username} leveled up from ${oldLevel} to ${newLevel} (+${levelsGained} levels)`,
      );

      rewards = await this.handleLevelUp(username, oldLevel, newLevel);

      const event = new LevelUpEvent(
        username,
        oldLevel,
        newLevel,
        newTotalXp,
        rewards,
      );
      this.eventEmitter.emit('user.levelUp', event);
    }

    return {
      xpAwarded: xpAmount,
      newLevel,
      leveledUp,
      levelsGained,
      rewards,
    };
  }

  /**
   * Award XP based on wager
   */
  async awardXpFromWager(
    username: string,
    wagerAmount: number | Decimal,
    gameType: GameType,
  ): Promise<{
    xpAwarded: number;
    newLevel: number;
    leveledUp: boolean;
    levelsGained: number;
    rewards?: any;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { xpMultiplier: true },
    });

    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    const xpAmount = this.calculateXpFromWager(
      wagerAmount,
      gameType,
      user.xpMultiplier,
    );

    return this.awardXp(username, xpAmount, `WAGER_${gameType}`);
  }

  /**
   * Handle level-up rewards
   */
  private async handleLevelUp(
    username: string,
    oldLevel: number,
    newLevel: number,
  ) {
    const rewards = {
      balanceBonus: 0,
      multiplierIncrease: 0,
      milestoneReached: false,
      milestoneName: null as string | null,
    };

    // Check for milestone rewards
    for (const [milestone, reward] of Object.entries(
      LEVELING_CONFIG.MILESTONE_REWARDS,
    )) {
      const milestoneLevel = parseInt(milestone);
      if (newLevel >= milestoneLevel && oldLevel < milestoneLevel) {
        rewards.balanceBonus += reward.balanceBonus;
        rewards.multiplierIncrease += reward.multiplierIncrease;
        rewards.milestoneReached = true;
        rewards.milestoneName = `Level ${milestoneLevel} Milestone`;

        this.logger.log(
          `User ${username} reached milestone level ${milestoneLevel}!`,
        );
      }
    }

    // Base level-up reward (scales with level)
    const baseLevelReward = Math.floor(newLevel * 5);
    rewards.balanceBonus += baseLevelReward;

    // Apply rewards
    if (rewards.balanceBonus > 0 || rewards.multiplierIncrease > 0) {
      await this.prisma.user.update({
        where: { username },
        data: {
          balance: {
            increment: new Decimal(rewards.balanceBonus),
          },
          xpMultiplier: {
            increment: new Decimal(rewards.multiplierIncrease),
          },
        },
      });
    }

    return rewards;
  }

  /**
   * Get user level information
   */
  async getUserLevelInfo(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        totalXP: true,
        currentLevel: true,
        xpMultiplier: true,
        profile_picture: true,
      },
    });

    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    const progress = this.getXpProgress(user.totalXP);
    const nextMilestone = this.getNextMilestone(user.currentLevel);
    const nextLevelRewards = this.calculateNextLevelRewards(user.currentLevel);

    return {
      user: {
        username: user.username,
        profilePicture: user.profile_picture,
        xpMultiplier: parseFloat(user.xpMultiplier.toString()),
      },
      ...progress,
      nextMilestone,
      nextLevelRewards,
    };
  }

  /**
   * Get level leaderboard
   */
  async getLevelLeaderboard(limit: number = 100, offset: number = 0) {
    const users = await this.prisma.user.findMany({
      take: limit,
      skip: offset,
      orderBy: [{ currentLevel: 'desc' }, { totalXP: 'desc' }],
      select: {
        username: true,
        profile_picture: true,
        currentLevel: true,
        totalXP: true,
      },
    });

    return users.map((user, index) => ({
      rank: offset + index + 1,
      username: user.username,
      profilePicture: user.profile_picture,
      level: user.currentLevel,
      totalXp: user.totalXP,
    }));
  }

  /**
   * Get user's rank on leaderboard
   */
  async getUserRank(username: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { currentLevel: true, totalXP: true },
    });

    if (!user) {
      throw new Error(`User ${username} not found`);
    }

    const rank = await this.prisma.user.count({
      where: {
        OR: [
          { currentLevel: { gt: user.currentLevel } },
          {
            AND: [
              { currentLevel: user.currentLevel },
              { totalXP: { gt: user.totalXP } },
            ],
          },
        ],
      },
    });

    return rank + 1;
  }

  /**
   * Get next milestone info
   */
  private getNextMilestone(currentLevel: number) {
    const milestones = Object.keys(LEVELING_CONFIG.MILESTONE_REWARDS)
      .map(Number)
      .sort((a, b) => a - b);

    const nextMilestone = milestones.find((m) => m > currentLevel);

    if (!nextMilestone) {
      return null;
    }

    return {
      level: nextMilestone,
      levelsToGo: nextMilestone - currentLevel,
      rewards: LEVELING_CONFIG.MILESTONE_REWARDS[nextMilestone],
    };
  }

  /**
   * Calculate rewards for next level
   */
  private calculateNextLevelRewards(currentLevel: number) {
    const nextLevel = currentLevel + 1;
    const baseLevelReward = Math.floor(nextLevel * 5);

    // Check if next level is a milestone
    const milestoneReward =
      LEVELING_CONFIG.MILESTONE_REWARDS[nextLevel] || null;

    return {
      balanceBonus: baseLevelReward + (milestoneReward?.balanceBonus || 0),
      multiplierIncrease: milestoneReward?.multiplierIncrease || 0,
      isMilestone: !!milestoneReward,
    };
  }

  /**
   * Get levels distribution (for analytics)
   */
  async getLevelsDistribution() {
    const distribution = await this.prisma.$queryRaw<
      Array<{ level: number; count: bigint }>
    >`
      SELECT 
        "currentLevel" as level,
        COUNT(*) as count
      FROM "User"
      GROUP BY "currentLevel"
      ORDER BY "currentLevel" ASC
    `;

    return distribution.map((d) => ({
      level: d.level,
      count: Number(d.count),
    }));
  }
}