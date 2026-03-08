import { IsNotEmpty, IsString, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePayoutDto {
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber()
  @Min(0.01, { message: 'Amount must be positive' })
  amount: number;

  @IsNotEmpty({ message: 'Currency is required' })
  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  kind?: string;
}
