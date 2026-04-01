import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistance/prisma/prisma.service';
import { RedisService } from '../cache/redis.service';

const THROTTLE_LOCK_MS = 120_000;
const IP_MAX_LEN = 64;

@Injectable()
export class UserActivityService {
  private readonly log = new Logger(UserActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  private throttleKey(username: string): string {
    return `bb:user:last_active:${username}`;
  }

  /**
   * Throttled DB touch: updates `last_active_at` and `last_known_ip` at most
   * once per `THROTTLE_LOCK_MS` per user (Redis NX lock).
   */
  async recordActivity(username: string, ip: string | null): Promise<void> {
    if (!username?.trim()) return;
    const cleanIp = (ip ?? '').trim();
    if (!cleanIp || cleanIp === 'unknown') return;

    const ipStore =
      cleanIp.length > IP_MAX_LEN ? cleanIp.slice(0, IP_MAX_LEN) : cleanIp;

    const acquired = await this.redis.lock(
      this.throttleKey(username),
      THROTTLE_LOCK_MS,
    );
    if (!acquired) return;

    try {
      await this.prisma.user.update({
        where: { username },
        data: {
          last_active_at: new Date(),
          last_known_ip: ipStore,
        },
      });
    } catch (e) {
      this.log.warn(`recordActivity failed for ${username}: ${e}`);
    }
  }
}
