import {
  IsString,
  IsNotEmpty,
  Matches,
  IsNumberString,
} from 'class-validator';

export class CreatePayoutTransactionDto {
  /**
   * Any crypto address (BTC, ETH, TRX, etc.)
   * Allows letters + numbers, typical crypto length
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9]{20,120}$/, {
    message: 'Invalid crypto address format',
  })
  address: string;

  /**
   * Decimal amount with max 2 decimal places
   * Examples: 1, 1.5, 1.23, 1000.00
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+(\.\d{1,20})?$/, {
    message: 'Amount must be a valid number with up to 20 decimal places',
  })
  amount: string;

}
