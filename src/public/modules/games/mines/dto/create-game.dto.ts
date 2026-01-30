import { IsInt, Min, Max, IsIn, IsNumber, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import { TwoDecimalPlacesRegex } from 'src/class-validator/TwoDecimalPlacesRegex.validator';

@ValidatorConstraint({ name: 'twoDecimalPlaces', async: false })
class TwoDecimalPlaces implements ValidatorConstraintInterface {
  validate(value: number, args: ValidationArguments) {
    return Number.isFinite(value) && Number((value * 100) % 1) === 0;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Bet amount must have at most 2 decimal places';
  }
}

export class CreateGameDto {
  @Min(0.01, { message: 'Bet amount must be at least 0.01' })
  @Max(3000, { message: 'Bet amount must not exceed 3000' })
  @Validate(TwoDecimalPlacesRegex)
  betAmount: number;

  @IsInt()
  @IsIn([16, 25], { message: 'Grid must be 16 or 25' })
  gridSize: 16 | 25;

  @IsInt()
  @Min(1)
  @Max(24)
  mineCount: number;
}
