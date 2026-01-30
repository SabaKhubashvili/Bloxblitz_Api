import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateChainDto {
  @IsString()
  @IsNotEmpty()
  chainId: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  roundNumber: number;
}

