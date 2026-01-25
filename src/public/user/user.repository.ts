import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';
import { RedisService } from 'src/provider/redis/redis.service';

@Injectable()
export class UserRepository {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /* ========== USER LOOKUPS ========== */

  async findUserByUsername(username: string) {
    return await this.prisma.user.findUnique({ where: { username } });
  }

  /* ========== CLIENT SEED CACHING ========== */

  async getCachedClientSeed(username: string): Promise<string | null> {
    return this.redis.get(`user:clientSeed:${username}`);
  }

  async cacheClientSeed(username: string, clientSeed: string): Promise<void> {
    await this.redis.set(`user:clientSeed:${username}`, clientSeed);
  }

  async findUserClientSeed(username: string): Promise<string> {
    const user = await this.prisma.$queryRaw<{ clientSeed: string }[]>`
      SELECT "client_seed" as "clientSeed" 
      FROM "User" 
      WHERE "username" = ${username}
    `;
    return user[0]?.clientSeed || '';
  }

  /* ========== BALANCE OPERATIONS (REDIS-FIRST) ========== */

  /**
   * Get balance from Redis cache (FAST PATH for games)
   * Falls back to DB if cache miss, then populates Redis
   */
  async getUserBalance(username: string): Promise<number> {
    // Try Redis first
    const cached = await this.redis.get(`user:balance:${username}`);
    if (cached !== null) {
      return parseFloat(cached);
    }

    // Cache miss - fetch from DB
    const userBalance = await this.prisma.$queryRaw<{ balance: number }[]>`
      SELECT balance FROM "User" WHERE "username" = ${username}
    `;

    const balance = userBalance[0]?.balance || 0;

    // Populate Redis cache
    await this.redis.set(`user:balance:${username}`, balance.toFixed(2));

    return balance;
  }
  async getValueBalance(username: string): Promise<number> {
    // Try Redis first
    const cached = await this.redis.get(RedisKeys.user.balance.value(username));
    if (cached !== null) {
      return parseFloat(cached);
    }

    const petBalance = await this.prisma.$queryRaw<{ sum: string }[]>`
  SELECT ROUND(CAST(SUM(value) AS numeric), 2) AS sum
  FROM "UserInventory"
  LEFT JOIN "Bot" ON "UserInventory".owner_bot_id = "Bot".id
  WHERE "userUsername" = ${username}
    AND "Bot".banned = false
`;

    const totalBalance = petBalance[0]?.sum || '0';
    const totalBalanceNumber = parseFloat(totalBalance);
    // Populate Redis cache
    await this.redis.set(
      RedisKeys.user.balance.value(username),
      totalBalanceNumber.toFixed(2),
    );

    return totalBalanceNumber;
  }
  /**
   * Decrement balance in Redis (for game bets)
   * Marks user as dirty for background sync to PostgreSQL
   */
  async decrementUserBalance(username: string, amount: number): Promise<void> {
    const newBalance = await this.redis.incrByFloat(
      `user:balance:${username}`,
      -(Math.round(amount * 100) / 100),
    );

    // Mark as dirty for sync worker
    await this.redis.sadd('user:balance:dirty', username);

    // Safety check - shouldn't happen if validation is correct
    if (parseFloat(newBalance) < 0) {
      throw new Error(`Negative balance for ${username}: ${newBalance}`);
    }
  }

  /**
   * Increment balance in Redis (for game wins/cashouts)
   * Marks user as dirty for background sync to PostgreSQL
   */
  async incrementUserBalance(username: string, amount: number): Promise<void> {
    await this.redis.incrByFloat(`user:balance:${username}`, amount);

    // Mark as dirty for sync worker
    await this.redis.sadd('user:balance:dirty', username);
  }

  /* ========== REAL MONEY OPERATIONS (DB-FIRST) ========== */

  /**
   * Handle deposits from external payment systems
   * Write-through pattern: DB first (durable), then Redis (fast)
   */
  async processDeposit(username: string, amount: number): Promise<number> {
    // 1. Update database first (source of truth for real money)
    const updatedUser = await this.prisma.user.update({
      where: { username },
      data: { balance: { increment: amount } },
    });

    // 2. Update Redis cache immediately
    await this.redis.set(
      `user:balance:${username}`,
      updatedUser.balance.toString(),
    );

    // 3. Remove from dirty set (DB already has correct value)
    await this.redis.srem('user:balance:dirty', username);

    return updatedUser.balance.toNumber();
  }

  /**
   * Handle withdrawals to external payment systems
   * Write-through pattern: DB first (atomic check), then Redis (fast)
   */
  async processWithdrawal(
    username: string,
    amount: number,
  ): Promise<number | null> {
    // Atomic check and decrement in DB
    const updatedUser = await this.prisma.$queryRaw<{ balance: number }[]>`
      UPDATE "User" 
      SET "balance" = "balance" - ${amount} 
      WHERE "username" = ${username} AND "balance" >= ${amount} 
      RETURNING "balance"
    `;

    if (updatedUser.length === 0) {
      return null; // Insufficient funds
    }

    const newBalance = updatedUser[0].balance;

    // Update Redis cache
    await this.redis.set(
      `user:balance:${username}`,
      -(Math.round(newBalance * 100) / 100),
    );

    // Remove from dirty set (DB already updated)
    await this.redis.srem('user:balance:dirty', username);

    return newBalance;
  }

  /**
   * @deprecated Use processWithdrawal() for real withdrawals
   * This method is kept for backwards compatibility but bypasses Redis strategy
   */
  async checkAndDecrement(
    username: string,
    amount: number,
  ): Promise<number | null> {
    console.warn(
      'checkAndDecrement is deprecated. Use processWithdrawal() instead.',
    );
    return this.processWithdrawal(username, amount);
  }

  /* ========== NONCE MANAGEMENT ========== */

  async getAndIncrementNonce(username: string): Promise<number> {
    return this.redis.incr(`nonce:user:${username}`);
  }
}
