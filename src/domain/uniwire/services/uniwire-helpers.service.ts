import { UniwireInvoiceKind } from '../ports/uniwire-api.ports';

export function getUniwireInvoiceKind(currency: string): UniwireInvoiceKind {
  switch (currency) {
    case 'BTC':
      return UniwireInvoiceKind.BTC;
    case 'ETH':
      return UniwireInvoiceKind.Ethereum;
    case 'LTC':
      return UniwireInvoiceKind.Litecoin;
    case 'USDT':
      return UniwireInvoiceKind.USDT;
    case 'DOGE':
      return UniwireInvoiceKind.DOGE;
    default:
      throw new Error(`Invalid currency: ${currency}`);
  }
}

export function isSupportedCurrency(currency: string): boolean {
  return Object.values(UniwireInvoiceKind).includes(
    getUniwireInvoiceKind(currency),
  );
}
