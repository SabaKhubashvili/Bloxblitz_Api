import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class VerifyCoinflipHttpDto {
  @IsString()
  @IsNotEmpty()
  serverSeed: string;

  @IsString()
  @IsNotEmpty()
  eosBlockId: string;

  @IsString()
  @IsNotEmpty()
  nonce: string;

  @IsOptional()
  @IsString()
  publicServerSeed?: string;

  @IsOptional()
  @IsNumber()
  expectedRandomValue?: number;
}
