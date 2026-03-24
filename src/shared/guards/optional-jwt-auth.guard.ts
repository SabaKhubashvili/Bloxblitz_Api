import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { isValidUserRole } from '../enums/user-role.enum';
import type { JwtPayload } from './jwt-auth.guard';

/**
 * Attaches `request.user` when a valid Bearer token is present; otherwise
 * leaves the request unauthenticated (no error).
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);
    if (!token) {
      return true;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (!isValidUserRole(payload.role)) {
        return true;
      }
      request['user'] = payload;
    } catch {
      /* ignore invalid optional token */
    }

    return true;
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
  }
}
