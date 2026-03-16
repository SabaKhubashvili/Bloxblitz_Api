import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import { PrismaService } from '../../persistance/prisma/prisma.service';
import { RedisKeys } from '../redis.keys';
import type {
  IDiceBalanceLedgerPort,
  PlaceDiceBetParams,
  PlaceDiceBetResult,
  SettleDicePayoutParams,
} from '../../../domain/game/dice/ports/dice-balance-ledger.port';

@Injectable()
export class DiceBalanceLedgerAdapter implements IDiceBalanceLedgerPort {
  private readonly logger = new Logger(DiceBalanceLedgerAdapter.name);

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async placeBet(params: PlaceDiceBetParams): Promise<PlaceDiceBetResult> {
    const { username, betAmount } = params;

    // Safeguard: ensure betAmount has at most 2 decimal places and is valid
    const sanitizedBet = Math.round(betAmount * 100) / 100;
    if (sanitizedBet <= 0) {
      return { success: false, error: 'INSUFFICIENT_BALANCE' };
    }

    // Seed Redis from DB if balance key is absent (first-time or evicted)
    await this.ensureBalanceSeeded(username);

    const lua = `
      local username   = ARGV[1]
      local betAmount  = tonumber(ARGV[2])

      local balanceKey = 'user:balance:' .. username
      local nonceKey   = 'user:nonce:'   .. username

      local balanceValue = redis.call('GET', balanceKey)
      if not balanceValue then
        return {0, 'INSUFFICIENT_BALANCE'}
      end

      local valueBalance = tonumber(balanceValue)
      if not valueBalance or valueBalance < betAmount then
        return {0, 'INSUFFICIENT_BALANCE'}
      end

      local nonce = redis.call('INCR', nonceKey)
      local newBalanceValue = math.floor((valueBalance - betAmount) * 100 + 0.5) / 100

      local balanceTtl = redis.call('TTL', balanceKey)
      redis.call('SET', balanceKey, newBalanceValue)
      if balanceTtl > 0 then
        redis.call('EXPIRE', balanceKey, balanceTtl)
      end

      redis.call('SADD', 'user:balance:dirty', username)

      return {1, nonce, tostring(newBalanceValue)}
    `;

    try {
      const result = await this.redis.eval(lua, {
        keys: [],
        arguments: [username, sanitizedBet.toString()],
      });

      if (!Array.isArray(result)) {
        this.logger.error(`[DiceLedger] placeBet unexpected result for ${username}`);
        return { success: false, error: 'REDIS_ERROR' };
      }

      if (result[0] === 0) {
        this.logger.warn(`[DiceLedger] placeBet rejected — user=${username}`);
        return { success: false, error: 'INSUFFICIENT_BALANCE' };
      }

      const nonce = result[1] as number;
      const balanceAfter = Math.round(parseFloat(result[2] as string) * 100) / 100;

      this.logger.log(
        `[DiceLedger] BET_PLACED user=${username} bet=-${betAmount} nonce=${nonce} balanceAfter=${balanceAfter}`,
      );

      return { success: true, nonce, balanceAfter };
    } catch (err) {
      this.logger.error(`[DiceLedger] placeBet failed for ${username}`, err);
      return { success: false, error: 'REDIS_ERROR' };
    }
  }

  async settlePayout(params: SettleDicePayoutParams): Promise<void> {
    const { username, profit } = params;
    const roundedProfit = Math.round(profit * 100) / 100;
    if (roundedProfit <= 0) return;

    const key = RedisKeys.user.balance.user(username);

    const lua = `
      local balanceKey = KEYS[1]
      local profit     = tonumber(ARGV[1])
      local username   = ARGV[2]

      local balanceValue = redis.call('GET', balanceKey)
      local newBalanceValue = profit
      if balanceValue then
        newBalanceValue = (tonumber(balanceValue) or 0) + profit
      end
      -- Safeguard: ensure balance has at most 2 decimal places
      newBalanceValue = math.floor(newBalanceValue * 100 + 0.5) / 100
      if balanceValue then
        local ttl = redis.call('TTL', balanceKey)
        redis.call('SET', balanceKey, newBalanceValue)
        if ttl > 0 then
          redis.call('EXPIRE', balanceKey, ttl)
        end
      else
        redis.call('SET', balanceKey, newBalanceValue)
      end

      redis.call('SADD', 'user:balance:dirty', username)
      return tostring(newBalanceValue)
    `;

    try {
      await this.redis.eval(lua, {
        keys: [key],
        arguments: [roundedProfit.toString(), username],
      });
      this.logger.log(
        `[DiceLedger] PAYOUT user=${username} profit=+${roundedProfit}`,
      );
    } catch (err) {
      this.logger.error(
        `[DiceLedger] settlePayout failed — user=${username}`,
        err,
      );
      throw err;
    }
  }

  private async ensureBalanceSeeded(username: string): Promise<void> {
    const key = RedisKeys.user.balance.user(username);
    const existing = await this.redis.mainClient.get(key);
    if (existing) return;

    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { balance: true },
    });
    const dbBalance = user
      ? Math.round(user.balance.toNumber() * 100) / 100
      : 0;
    await this.redis.mainClient.set(key, dbBalance, { NX: true });
    this.logger.debug(
      `[DiceLedger] Seeded Redis for ${username} from DB: ${dbBalance}`,
    );
  }
}
