import { IsNotEmpty, IsString, Min } from 'class-validator';

export class GetCrashHistoryByHashDto {
  @IsString()
  @IsNotEmpty()
  chainId: string;
  @IsString()
  @IsNotEmpty()
  gameHash: string;
}
