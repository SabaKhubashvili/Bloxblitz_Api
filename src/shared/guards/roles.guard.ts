import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import type { JwtPayload } from './jwt-auth.guard';

/**
 * Enforces role-based access control.
 *
 * This guard MUST run **after** `JwtAuthGuard` so that `request.user` is
 * already populated with a verified `JwtPayload`.
 *
 * Behaviour:
 *  - If the handler (or its controller) has no `@Roles()` metadata the guard
 *    passes — the route only requires authentication, not a specific role.
 *  - If `@Roles()` metadata is present, the user's `role` must be included in
 *    the allowed list; otherwise a `ForbiddenException` is thrown.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtPayload | undefined;

    if (!user?.role) {
      throw new ForbiddenException('Access denied: no role present in token');
    }

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        'Access denied: insufficient role privileges',
      );
    }

    return true;
  }
}
