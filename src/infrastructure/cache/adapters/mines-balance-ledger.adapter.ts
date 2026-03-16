import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import type {
  IMinesBalanceLedgerPort,
  PlaceBetParams,
  PlaceBetResult,
  SettlePayoutParams,
} from '../../../application/game/mines/ports/mines-balance-ledger.port';

/** Per-game audit ledger key. Capped at 50 entries, TTL 7 days. */
const auditKey = (gameId: string) => `ledger:mines:${gameId}`;
const AUDIT_CAP = 49; // LTRIM keeps indices 0..N-1 → 50 entries total
const AUDIT_TTL_SECONDS = 604_800; // 7 days

/**
 * Concrete implementation of IMinesBalanceLedgerPort.
 *
 * Every mutating method is a single Lua script executed by Redis so the
 * entire operation (guard → deduct/credit → mark dirty → audit) is atomic
 * and isolated from concurrent requests for the same user.
 */
@Injectable()
export class MinesBalanceLedgerAdapter implements IMinesBalanceLedgerPort {
  private readonly logger = new Logger(MinesBalanceLedgerAdapter.name);

  constructor(private readonly redis: RedisService) {}

  // ── placeBet ───────────────────────────────────────────────────────────────

  async placeBet(params: PlaceBetParams): Promise<PlaceBetResult> {
    const { username, betAmount, gameId, gameData } = params;

    /*
     * Single Lua script — Redis executes this as one atomic unit:
     *   1. Reject if an active mines game already exists for this user.
     *   2. Reject if balance < betAmount.
     *   3. Increment the provably-fair nonce.
     *   4. Deduct bet from live balance.
     *   5. Persist game state (with injected nonce) to Redis.
     *   6. Set the user's active-game pointer.
     *   7. Mark balance dirty for the DB sync worker.
     *   8. Append BET_PLACED entry to the per-game audit ledger.
     */
    const lua = `
      local username    = ARGV[1]
      local betAmount   = tonumber(ARGV[2])
      local gameId      = ARGV[3]
      local gameDataStr = ARGV[4]
      local ts          = ARGV[5]

      local activeKey  = 'user:mines:active:' .. username
      local balanceKey = 'user:balance:'      .. username
      local nonceKey   = 'user:nonce:'        .. username
      local gameKey    = 'mines:game:'        .. gameId
      local auditKey   = 'ledger:mines:'      .. gameId

      -- 1. Guard: one active game per user
      if redis.call('GET', activeKey) then
        return {0, 'ACTIVE_GAME_EXISTS'}
      end

      -- 2. Guard: sufficient balance
      local balanceValue = redis.call('GET', balanceKey)
      if not balanceValue then
        return {0, 'INSUFFICIENT_BALANCE'}
      end

      local valueBalance = tonumber(balanceValue)
      if not valueBalance or valueBalance < betAmount then
        return {0, 'INSUFFICIENT_BALANCE'}
      end

      -- 3. Increment nonce (provably-fair counter)
      local nonce = redis.call('INCR', nonceKey)

      -- 4. Deduct bet (JSON read-modify-write; balanceObj already decoded above)
      local newBalanceValue = valueBalance - betAmount
      local balanceTtl = redis.call('TTL', balanceKey)
      redis.call('SET', balanceKey, newBalanceValue)
      if balanceTtl > 0 then
        redis.call('EXPIRE', balanceKey, balanceTtl)
      end

      -- 5. Inject nonce into game data and persist
      local obj = cjson.decode(gameDataStr)
      obj['nonce'] = nonce
      redis.call('SET',    gameKey, cjson.encode(obj))
      redis.call('EXPIRE', gameKey, 86400)

      -- 6. Set active-game pointer
      redis.call('SET',    activeKey, gameId)
      redis.call('EXPIRE', activeKey, 3600)

      -- 7. Mark balance dirty for DB sync
      redis.call('SADD', 'user:balance:dirty', username)

      -- 8. Audit log
      local entry = cjson.encode({
        action      = 'BET_PLACED',
        username    = username,
        delta       = -betAmount,
        balanceAfter = newBalanceValue,
        ts          = tonumber(ts)
      })
      redis.call('LPUSH',  auditKey, entry)
      redis.call('LTRIM',  auditKey, 0, ${AUDIT_CAP})
      redis.call('EXPIRE', auditKey, ${AUDIT_TTL_SECONDS})

      return {1, nonce, tostring(newBalanceValue)}
    `;

    let result: unknown;
    try {
      result = await this.redis.eval(lua, {
        keys: [],
        arguments: [
          username,
          betAmount.toString(),
          gameId,
          JSON.stringify(gameData),
          Date.now().toString(),
        ],
      });
    } catch (err) {
      this.logger.error(`[Ledger] placeBet eval error for ${username}`, err);
      return { success: false, error: 'REDIS_ERROR' };
    }

    if (!Array.isArray(result)) {
      this.logger.error(`[Ledger] placeBet unexpected result type for ${username}`);
      return { success: false, error: 'REDIS_ERROR' };
    }

    if (result[0] === 0) {
      const code = result[1] as string;
      this.logger.warn(`[Ledger] placeBet rejected — user=${username} reason=${code}`);
      return {
        success: false,
        error: code === 'ACTIVE_GAME_EXISTS' ? 'ACTIVE_GAME_EXISTS' : 'INSUFFICIENT_BALANCE',
      };
    }

    const nonce = result[1] as number;
    const balanceAfter = parseFloat(result[2] as string);

    this.logger.log(
      `[Ledger] BET_PLACED game=${gameId} user=${username} bet=-${betAmount} balanceAfter=${balanceAfter}`,
    );

    return { success: true, nonce, balanceAfter };
  }

  // ── settlePayout ───────────────────────────────────────────────────────────

  async settlePayout(params: SettlePayoutParams): Promise<void> {
    const { username, gameId, profit, reason } = params;
    const roundedProfit = Math.round(profit * 100) / 100;

    /*
     * Single Lua script — atomic:
     *   1. Credit profit to live balance.
     *   2. Mark balance dirty for DB sync.
     *   3. Append payout entry to the per-game audit ledger.
     */
    const lua = `
      local username = ARGV[1]
      local profit   = tonumber(ARGV[2])
      local gameId   = ARGV[3]
      local reason   = ARGV[4]
      local ts       = ARGV[5]

      local balanceKey = 'user:balance:' .. username
      local auditKey   = 'ledger:mines:' .. gameId

      -- 1. Credit profit (JSON read-modify-write).
      --    If the balance key has been evicted we still must persist the payout
      --    so the dirty-flag flush has a value to write to PostgreSQL.
      local balanceValue = redis.call('GET', balanceKey)
      local newBalanceValue = profit
      if balanceValue then
        newBalanceValue = (tonumber(balanceValue) or 0) + profit
        local ttl = redis.call('TTL', balanceKey)
        redis.call('SET', balanceKey, newBalanceValue)
        if ttl > 0 then
          redis.call('EXPIRE', balanceKey, ttl)
        end
      else
        -- Balance was evicted; seed a fresh entry with just the payout amount.
        -- The balance-sync worker will reconcile against PostgreSQL on next flush.
        redis.call('SET', balanceKey, cjson.encode({b = profit}))
      end

      -- 2. Mark dirty
      redis.call('SADD', 'user:balance:dirty', username)

      -- 3. Audit log
      local entry = cjson.encode({
        action      = reason,
        username    = username,
        delta       = profit,
        balanceAfter = newBalanceValue,
        ts          = tonumber(ts)
      })
      redis.call('LPUSH',  auditKey, entry)
      redis.call('LTRIM',  auditKey, 0, ${AUDIT_CAP})
      redis.call('EXPIRE', auditKey, ${AUDIT_TTL_SECONDS})

      return tostring(newBalanceValue)
    `;

    try {
      const newBalance = await this.redis.eval(lua, {
        keys: [],
        arguments: [
          username,
          roundedProfit.toString(),
          gameId,
          reason,
          Date.now().toString(),
        ],
      });

      this.logger.log(
        `[Ledger] ${reason} game=${gameId} user=${username} profit=+${roundedProfit} balanceAfter=${newBalance}`,
      );
    } catch (err) {
      this.logger.error(
        `[Ledger] settlePayout failed — user=${username} game=${gameId} reason=${reason}`,
        err,
      );
      throw err;
    }
  }
}
