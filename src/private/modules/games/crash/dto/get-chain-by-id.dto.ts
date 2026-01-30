import { IsNotEmpty, IsString, Min } from 'class-validator';

export class GetChainByIdDto {
  @IsString()
  @IsNotEmpty()
  chainId: string;
}
