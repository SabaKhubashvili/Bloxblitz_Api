export interface CreatePayoutCommand {
  readonly username: string;
  readonly amount: number;
  readonly currency: string;
  readonly kind?: string;
}
