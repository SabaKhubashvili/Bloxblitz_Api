/**
 * DI token for the shared live balance repository (increment + decrement).
 *
 * Bind to {@link UserBalanceRedisRepository} in modules that use
 * {@link IncrementUserBalanceUseCase} and/or {@link DecrementUserBalanceUseCase}.
 */
export const USER_BALANCE_REPOSITORY = Symbol('USER_BALANCE_REPOSITORY');
