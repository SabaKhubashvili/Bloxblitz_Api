import {
  IsInt,
  Min,
  Max,
  IsIn,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'twoDecimalPlacesRegex', async: false })
export class TwoDecimalPlacesRegex implements ValidatorConstraintInterface {
  validate(value: number, args: ValidationArguments) {
    return typeof value === 'number' && /^[0-9]+(\.[0-9]{1,2})?$/.test(value.toString());
  }

  defaultMessage(args: ValidationArguments) {
    return 'Bet amount must have at most 2 decimal places';
  }
}
