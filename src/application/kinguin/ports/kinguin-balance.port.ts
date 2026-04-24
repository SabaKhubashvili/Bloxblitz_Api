export interface IKinguinBalancePort {
  getBalance(username: string): Promise<number>;
  creditBalance(username: string, amount: number): Promise<number>;
}
