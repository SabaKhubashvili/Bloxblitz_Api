import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class GetTransactionConfirmationsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one transaction ID is required' })
  @IsString({ each: true })
  transactionIds: string[];
}
