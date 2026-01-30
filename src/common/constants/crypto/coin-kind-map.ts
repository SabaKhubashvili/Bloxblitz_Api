import { AvailableCryptos } from '@prisma/client';

export const coinKindMap: Record<AvailableCryptos, string> = {
  BTC: 'BTC',
  LTC: 'LTC',
  ETH: 'ETH',
  USDT: 'ETH',
  DOGE: 'DOGE',
};
