/**
 * Mirrors the Prisma `UserRoles` enum.
 *
 * Centralised here so that guards, decorators, and DTOs reference a single
 * TypeScript enum instead of raw strings, preventing typos and drift between
 * the DB schema and runtime code.
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  OWNER = 'OWNER',
  MODERATOR = 'MODERATOR',
  SUPPORT = 'SUPPORT',
  COMMUNITY_MANAGER = 'COMMUNITY_MANAGER',
  MEMBER = 'MEMBER',
  WHALE = 'WHALE',
  BIGFLIPPER = 'BIGFLIPPER',
}

/** Roles that grant access to staff/admin endpoints. */
export const STAFF_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.OWNER,
  UserRole.MODERATOR,
  UserRole.SUPPORT,
  UserRole.COMMUNITY_MANAGER,
] as const;

const USER_ROLE_VALUES = new Set<string>(Object.values(UserRole));

/** Type-guard: returns true when `value` is a valid UserRole string. */
export function isValidUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && USER_ROLE_VALUES.has(value);
}
