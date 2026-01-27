import { IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class SetPrivateProfileDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  privateProfile: boolean;
}
