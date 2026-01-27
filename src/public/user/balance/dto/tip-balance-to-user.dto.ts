import {
  IsNumber,
  IsString,
  Matches,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';
import { TwoDecimalPlacesRegex } from 'src/class-validator/TwoDecimalPlacesRegex.validator';

export class TipBalanceToUserDto {
  @IsString()
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username contains invalid characters',
  })
  receipmentUsername: string;

  @IsNumber()
  @Validate(TwoDecimalPlacesRegex)
  @Min(0.01)
  amount: number;
}
