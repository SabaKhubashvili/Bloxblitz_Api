import { AvailableCryptos } from "@prisma/client";

export const minConfirmationMap: Record<AvailableCryptos, number> = {
  BTC: 1,
  LTC: 2,
  ETH: 12,
  USDT: 12,
  DOGE: 6,
};