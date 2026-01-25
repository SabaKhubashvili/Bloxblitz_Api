import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRoles } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
export interface UserPayload {
  username: string;
  avatar_url: string;
  id?: string;

  role: UserRoles;
}

export interface OptionalAuthenticatedRequest extends Request {
  user?: UserPayload;
}

@Injectable()
export class JwtOptionalGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<OptionalAuthenticatedRequest>();
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return true;
    }
    const [type, token] = authHeader.split(' ');
    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || '',
        ) as UserPayload;

        req.user = decoded;

        return true;
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          error.name === 'TokenExpiredError'
        ) {
          throw new UnauthorizedException(' expired token');
        }

        throw new UnauthorizedException('Invalid or expired token');
      }
    } else {
      return true;
    }
  }
}
