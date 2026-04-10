import { Injectable } from '@nestjs/common';
import { Result, Ok, Err } from '../../../../domain/shared/types/result.type';
import type { TowersWagerReservation } from '../../../../domain/game/towers/towers-player-restriction.snapshot';
import {
  TowersPlayerBannedError,
  TowersWagerLimitExceededError,
  type TowersError,
} from '../../../../domain/game/towers/errors/towers.errors';
import { TowersRestrictionRedisService } from '../../../../infrastructure/cache/towers-restriction.redis.service';

@Injectable()
export class ValidateTowersPlayRestrictionUseCase {
  constructor(
    private readonly towersRestrictionRedis: TowersRestrictionRedisService,
  ) {}

  async validateAndReserve(
    username: string,
    betAmount: number,
  ): Promise<Result<TowersWagerReservation, TowersError>> {
    const res = await this.towersRestrictionRedis.tryReserveWagers(
      username,
      betAmount,
    );
    if (!res.ok) {
      if (res.kind === 'banned') {
        return Err(new TowersPlayerBannedError(res.banReason));
      }
      const p =
        res.window === 'DAILY'
          ? 'daily'
          : res.window === 'WEEKLY'
            ? 'weekly'
            : 'monthly';
      return Err(new TowersWagerLimitExceededError(p));
    }
    return Ok({ appliedWindows: res.applied });
  }

  async rollback(
    username: string,
    betAmount: number,
    reservation: TowersWagerReservation,
  ): Promise<void> {
    if (reservation.appliedWindows.length === 0) return;
    await this.towersRestrictionRedis.rollbackWagers(
      username,
      betAmount,
      reservation.appliedWindows,
    );
  }
}
