/**
 * DI tokens for the Leveling bounded context.
 * Symbol-based tokens prevent accidental token collisions across modules.
 */
export const LEVELING_REPOSITORY = Symbol('LEVELING_REPOSITORY');
export const LEVELING_CACHE_PORT  = Symbol('LEVELING_CACHE_PORT');
