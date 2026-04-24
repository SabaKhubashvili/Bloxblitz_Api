import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const CODE_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * Body for POST /affiliate/use-code and POST /affiliate/create-code.
 * Server normalizes (trim, lowercase) in the application layer.
 */
export class AffiliateCodeBodyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(32)
  @Matches(CODE_REGEX, {
    message: 'code must contain only letters, numbers, underscores, or hyphens',
  })
  code!: string;
}
