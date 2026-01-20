import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

export function TwoDecimalPlacesRegex(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'twoDecimalPlacesRegex',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return typeof value === 'number' && /^-?\d+(\.\d{1,2})?$/.test(value.toString());
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must have at most two decimal places`;
        },
      },
    });
  };
}
