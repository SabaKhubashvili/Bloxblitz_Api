/**
 * Dependency-injection tokens for the user bounded context.
 * Using Symbols prevents accidental token collisions across modules.
 */
export const BALANCE_REPOSITORY = Symbol('BALANCE_REPOSITORY');
export const BALANCE_CACHE_PORT = Symbol('BALANCE_CACHE_PORT');
