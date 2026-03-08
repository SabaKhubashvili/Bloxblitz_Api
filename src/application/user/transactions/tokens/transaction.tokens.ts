/**
 * Injection token for ITransactionHistoryRepository.
 * Bound to PrismaTransactionHistoryRepository in TransactionModule.
 */
export const TRANSACTION_HISTORY_REPOSITORY = Symbol('TRANSACTION_HISTORY_REPOSITORY');
