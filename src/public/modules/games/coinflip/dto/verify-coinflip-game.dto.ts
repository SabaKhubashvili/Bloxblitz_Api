import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyCoinflipGameDto {
  @IsString()
  @IsNotEmpty()
  serverSeed: string;

  @IsString()
  @IsNotEmpty()
  eosBlockId: string;

  @IsString()
  @IsNotEmpty()
  nonce: string;
}