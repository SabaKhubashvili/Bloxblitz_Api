import { IsString, MinLength } from 'class-validator';

export class OpenRewardCaseHttpDto {
  @IsString()
  @MinLength(1)
  slug!: string;
}
