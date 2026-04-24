export interface CreatePayoutCommand {
  readonly username: string;
  readonly amount: number;
  readonly currency: string;
  readonly address: string;
  readonly kind: string;
  readonly symbol: string;
}
