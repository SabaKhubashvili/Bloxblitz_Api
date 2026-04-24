import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

@Injectable()
export class InternalMicroserviceSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('INTERNAL_MICROSERVICE_SECRET');
    const method = context.switchToHttp().getRequest<Request>().method;
    if (!expected || expected.length < 8) {
      throw new NotFoundException(
        `Cannot ${method.toUpperCase()} to /api/v1/internal/affiliate/wager-commission`,
      );
    }

    const req = context.switchToHttp().getRequest<Request>();
    const header = req.headers['x-internal-service-secret'];
    const provided =
      typeof header === 'string'
        ? header
        : Array.isArray(header)
          ? header[0]
          : '';

    if (provided !== expected) {
      throw new NotFoundException(
        `Cannot ${method.toUpperCase()} to /api/v1/internal/affiliate/wager-commission`,
      );
    }

    return true;
  }
}
