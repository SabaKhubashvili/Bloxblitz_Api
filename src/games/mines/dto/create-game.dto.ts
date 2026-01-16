import { IsInt, Min, Max, IsIn, IsNumber, Validate, ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

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
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Bet amount must be a number with up to 2 decimal places' })
  @Min(0.01, { message: 'Bet amount must be at least 0.01' })
  @Max(3000, { message: 'Bet amount must not exceed 3000  ' })
  @Validate(TwoDecimalPlaces)
  betAmount: number;

  @IsInt()
  @IsIn([16, 25], {
    message: 'Grid must be 16 or 25',
  })
  gridSize: 16 | 25;

  @IsInt()
  @Min(1)
  @Max(24)
  mineCount: number;
}
