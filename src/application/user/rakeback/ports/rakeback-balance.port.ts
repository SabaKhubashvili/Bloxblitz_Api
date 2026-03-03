export interface IRakebackBalancePort {
  getBalance(username: string): Promise<number>;
  creditBalance(username: string, amount: number): Promise<void>;
}
