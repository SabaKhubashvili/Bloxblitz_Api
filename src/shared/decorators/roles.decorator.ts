import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/**
 * Marks a route (or controller) as accessible only to users whose JWT `role`
 * is included in the supplied list.
 *
 * Must be combined with `RolesGuard` to take effect.
 *
 * @example
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Roles(UserRole.ADMIN, UserRole.OWNER)
 *   @Patch(':username')
 *   setUserLevel() { ... }
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
