import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { RedisService } from '../../../../../../infrastructure/cache/redis.service';
import { RedisKeys } from '../../../../../../infrastructure/cache/redis.keys';

/** Max `GET /cases` requests per window per client fingerprint. */
const CASES_LIST_RL_MAX = 180;
/** Window length (seconds) for the counter key. */
const CASES_LIST_RL_WINDOW_SEC = 60;

function fingerprintFromRequest(req: Request): string {
  const xf = req.headers['x-forwarded-for'];
  const raw =
    typeof xf === 'string'
      ? xf.split(',')[0]?.trim() || ''
      : Array.isArray(xf)
        ? xf[0]?.trim() || ''
        : '';
  const ip = raw || req.ip || req.socket?.remoteAddress || 'unknown';
  return createHash('sha256').update(ip, 'utf8').digest('hex').slice(0, 16);
}

@Injectable()
export class CasesListRateLimitGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const fp = fingerprintFromRequest(req);
    const key = RedisKeys.rateLimit.casesList(fp);

    const n = await this.redis.incr(key);
    if (n === 1) {
      await this.redis.expire(key, CASES_LIST_RL_WINDOW_SEC);
    }
    if (n > CASES_LIST_RL_MAX) {
      throw new HttpException(
        'Too many catalog requests; try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
