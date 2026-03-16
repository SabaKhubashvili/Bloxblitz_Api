import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UserRole, isValidUserRole } from '../enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  id: string;
  username: string;
  profilePicture: string;
  role: UserRole;
}

/**
 * Verifies the Bearer token and attaches a validated `JwtPayload` to the
 * request.  The `role` claim is validated against the `UserRole` enum to
 * prevent tokens with spoofed or garbage role values from passing through.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      if (!isValidUserRole(payload.role)) {
        throw new UnauthorizedException('Token contains an invalid role');
      }

      request['user'] = payload;
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractBearerToken(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    return authHeader.slice(7);
  }
}
