export interface IDailySpinBalancePort {
  creditBalance(username: string, amount: number): Promise<void>;
}
