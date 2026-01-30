export enum CallbackStatus {
  TRANSACTION_PENDING = 'transaction_pending',
  TRANSACTION_CONFIRMED = 'transaction_confirmed',
  TRANSACTION_COMPLETED = 'transaction_complete',
  INVOICE_PENDING = 'invoice_pending',
  INVOICE_CONFIRMED = 'invoice_confirmed',
  INVOICE_COMPLETED = 'invoice_complete',
  PAYOUT_CONFIRMED = 'payout_confirmed',
  PAYOUT_COMPLETED = 'payout_complete',
}

export enum Network {
  TESTNET = 'testnet',
  MAINNET = 'mainnet',
}
