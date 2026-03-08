export interface CreateDepositInvoiceCommand {
  readonly username: string;
  readonly currency: string;
  readonly kind: string;
  readonly passthrough?: Record<string, string>;
}
