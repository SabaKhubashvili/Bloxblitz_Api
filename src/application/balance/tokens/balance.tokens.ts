/**
 * DI token for the global balance-increment port.
 *
 * Bind to `IncrementUserBalanceAdapter` in any module that uses
 * `IncrementUserBalanceUseCase`.
 */
export const INCREMENT_USER_BALANCE_PORT = Symbol('INCREMENT_USER_BALANCE_PORT');
