// dto/username-param.dto.ts
import { IsString, MaxLength, Matches } from 'class-validator';

export class UsernameParamDto {
  @IsString()
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'Username contains invalid characters',
  })
  username: string;
}
