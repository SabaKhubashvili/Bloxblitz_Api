import { IsNotEmpty, IsString, IsOptional, IsObject } from 'class-validator';

export class CreateDepositInvoiceDto {
  @IsNotEmpty({ message: 'Currency is required' })
  @IsString()
  currency: string;

  @IsNotEmpty({ message: 'Kind is required' })
  @IsString()
  kind: string;

  @IsOptional()
  @IsObject()
  passthrough?: Record<string, string>;
}
