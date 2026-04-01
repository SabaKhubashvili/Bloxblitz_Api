import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisKeys } from './redis.keys';

@Injectable()
export class RaceLeaderboardZsetService {
  private readonly logger = new Logger(RaceLeaderboardZsetService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Mirrors `RaceParticipant.wageredAmount` in Redis sorted set
   * `race:{raceId}:leaderboard` (score = total credited wager).
   */
  async incrementWagered(
    raceId: string,
    username: string,
    amount: number,
  ): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) return;
    try {
      if (!this.redis.mainClient.isOpen) return;
      await this.redis.mainClient.zIncrBy(
        RedisKeys.race.leaderboard(raceId),
        amount,
        username,
      );
    } catch (e) {
      this.logger.warn(
        `[RaceLeaderboardZset] zIncrBy failed race=${raceId} user=${username}`,
        e,
      );
    }
  }
}
