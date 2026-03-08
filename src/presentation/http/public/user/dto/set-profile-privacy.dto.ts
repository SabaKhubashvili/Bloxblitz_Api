import { IsBoolean, IsNotEmpty } from 'class-validator';

export class SetProfilePrivacyHttpDto {
  @IsBoolean()
  @IsNotEmpty()
  privateProfile: boolean;
}
