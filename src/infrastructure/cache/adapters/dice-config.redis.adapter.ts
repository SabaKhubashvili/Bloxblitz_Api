import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis.service';
import type { IDiceConfigPort } from '../../../application/game/dice/ports/dice-config.port';
import {
  cloneDiceConfig,
  DEFAULT_DICE_CONFIG,
  DICE_CONFIG_REDIS_KEY,
  diceConfigFromRedisHash,
  type DiceConfig,
  validateDiceConfig,
} from '../../../domain/game/dice/dice-config';

/** Last good snapshot — used only when Redis errors (same idea as admin dice repo). */
let diceConfigMemoryFallback: DiceConfig | null = null;

@Injectable()
export class DiceConfigRedisAdapter implements IDiceConfigPort {
  private readonly log = new Logger(DiceConfigRedisAdapter.name);

  constructor(private readonly redis: RedisService) {}

  async getConfig(): Promise<DiceConfig> {
    const defaults = cloneDiceConfig(DEFAULT_DICE_CONFIG);

    try {
      const hash = await this.redis.hgetall(DICE_CONFIG_REDIS_KEY);
      const resolved =
        Object.keys(hash).length === 0
          ? defaults
          : diceConfigFromRedisHash(hash, defaults);

      if (!validateDiceConfig(resolved)) {
        this.log.warn(
          '[DiceConfig] Merged config failed validation; serving defaults',
        );
        diceConfigMemoryFallback = defaults;
        return cloneDiceConfig(defaults);
      }

      diceConfigMemoryFallback = cloneDiceConfig(resolved);
      return cloneDiceConfig(resolved);
    } catch (e) {
      this.log.warn(
        `[DiceConfig] Redis HGETALL failed: ${e instanceof Error ? e.message : e}`,
      );
      if (
        diceConfigMemoryFallback &&
        validateDiceConfig(diceConfigMemoryFallback)
      ) {
        return cloneDiceConfig(diceConfigMemoryFallback);
      }
      return cloneDiceConfig(defaults);
    }
  }
}
