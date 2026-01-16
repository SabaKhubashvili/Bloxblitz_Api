import { RedeemResult } from '../contracts/redeem-result.contract';
// balance.provider.ts
export interface BalanceProvider {
  checkKinguinCodeAvailability(userId: string, code: string): Promise<boolean>;
  redeemKinguinCode(userId: string, code: string): Promise<[number,number]>;
}
