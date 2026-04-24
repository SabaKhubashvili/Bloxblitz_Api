import { AvailableCryptos } from '@prisma/client';

export interface GetDepositAddressQuery {
  readonly username: string;
  readonly currency: string;
}
