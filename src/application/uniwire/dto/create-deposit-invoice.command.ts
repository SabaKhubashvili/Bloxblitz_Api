import { AvailableCryptos } from "@prisma/client";
import { UniwireInvoiceKind } from "src/domain/uniwire/ports/uniwire-api.ports";

export interface CreateDepositInvoiceCommand {
  readonly username: string;
  readonly currency: AvailableCryptos;
  readonly kind: UniwireInvoiceKind;
  readonly passthrough?: Record<string, string>;
}
