// balance/contracts/redeem-result.contract.ts
export interface RedeemResult {
  success: boolean;
  message?: string;

  transactionId?: string;
  pending?: boolean;

  newBalance?: number;
}
