import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { CallbackStatus, Network } from '../types/callbackStatus.enum';

export class AmountCurrencyDto {
  @Transform(({ value }) => value !== null && value !== undefined ? String(value) : value)
  @IsString()
  amount: string;

  @IsString()
  currency: string;
}

export class QuotesDto {
  @IsOptional()
  @IsNumber()
  USD?: number;
}
export class InvoiceAmountDto {
  @ValidateNested()
  @Type(() => AmountCurrencyDto)
  requested: AmountCurrencyDto;

  @ValidateNested()
  @Type(() => AmountCurrencyDto)
  @IsOptional()
  received?: AmountCurrencyDto;

  @ValidateNested()
  @Type(()=> AmountCurrencyDto)
  @IsOptional()
  invoiced?: AmountCurrencyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => AmountCurrencyDto)
  paid?: AmountCurrencyDto;
}

export class TransactionPaidDto {
  @IsNumber()
  amount: number;

  @IsString()
  currency: string;

  @IsOptional()
  @IsObject()
  quotes?: Record<string, number>;
}

export class TransactionAmountDto {
  @ValidateNested()
  @Type(() => TransactionPaidDto)
  paid: TransactionPaidDto;
}


export class TransactionSummaryDto {
  @IsUUID()
  id: string;

  @IsString()
  txid: string;

  @IsString()
  kind: string;

  @IsNumber()
  confirmations: number;

  @IsNumber()
  amount: number;

  @IsString()
  created_at: string;

  @IsString()
  currency: string;

  @IsOptional()
  @IsString()
  url?: string;
}

// InvoiceDto only references transaction IDs, not full transaction objects
export class InvoiceDto {
  @IsUUID()
  id: string;

  @IsString()
  kind: string;

  @IsString()
  created_at: string;

  @IsUUID()
  profile_id: string;

  @IsString()
  address: string;

  @IsOptional()
  lightning: any;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  expires_at?: string;

  @IsEnum(Network)
  network: Network;

  @ValidateNested()
  @Type(() => InvoiceAmountDto)
  amount: InvoiceAmountDto;

  @IsOptional()
  custom_fee?: any;

  @IsOptional()
  min_confirmations?: number;

  @IsOptional()
  zero_conf_enabled?: boolean;

  @IsOptional()
  notes?: string;

  @IsOptional()
  passthrough?: any;

  // Instead of full TransactionDto, just store IDs
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransactionSummaryDto)
  transactions?: TransactionSummaryDto[];
}


export class TransactionDto {
  @IsUUID()
  id: string;

  @IsString()
  kind: string;

  @IsString()
  txid: string;

  @ValidateNested()
  @Type(() => InvoiceDto)
  invoice: InvoiceDto;

  @ValidateNested()
  @Type(() => TransactionAmountDto)
  amount: TransactionAmountDto;

  @IsObject()
  currency_rates: Record<string, Record<string, number>>;

  @IsString()
  created_at: string;

  @IsOptional()
  executed_at?: string;

  @IsOptional()
  confirmed_at?: string;

  @IsNumber()
  confirmations: number;

  @IsString()
  @IsOptional()
  status?: string;

  @IsEnum(Network)
  @IsOptional()
  network?: Network;

  @IsOptional()
  zero_conf_status?: any;

  @IsOptional()
  risk_level?: any;

  @IsOptional()
  risk_data?: any;

  @IsOptional()
  sub_kind?: any;

  @IsOptional()
  @IsString()
  url?: string;
}

export class PayoutRecipientDto {
  @IsUUID()
  id: string;

  @IsString()
  address: string;

  @ValidateNested()
  @Type(() => InvoiceAmountDto)
  amount: InvoiceAmountDto;

  @IsOptional()
  custom_fee?: any;

  @IsOptional()
  notes?: string;
}

export class PayoutDto {
  @IsUUID()
  id: string;

  @IsString()
  kind: string;

  @IsString()
  txid: string;

  @IsString()
  created_at: string;

  @IsString()
  approved_at: string;

  @IsString()
  executed_at: string;

  @IsUUID()
  profile_id: string;

  @IsUUID()
  wallet_id: string;

  @IsNumber()
  confirmations: number;

  @IsString()
  status: string;

  @IsEnum(Network)
  network: Network;

  @IsObject()
  amount: {
    total: number;
    network_fee: number;
  };

  @IsString()
  network_fee_preset: string;

  @IsString()
  network_fee_pays: string;

  @IsNumber()
  network_fee: number;

  @IsOptional()
  passthrough?: any;

  @IsOptional()
  reference_id?: string;

  @IsOptional()
  sub_kind?: any;

  @IsOptional()
  error?: any;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PayoutRecipientDto)
  recipients: PayoutRecipientDto[];
}

export class CryptoCallbackDto {
  @IsUUID()
  callback_id: string;

  @IsEnum(CallbackStatus)
  callback_status: CallbackStatus;

  @IsString()
  signature: string;

  // transaction_* callbacks
  @IsOptional()
  @ValidateNested()
  @Type(() => TransactionDto)
  transaction?: TransactionDto;

  // invoice_confirmed
  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceDto)
  invoice?: InvoiceDto;

  // payout_confirmed
  @IsOptional()
  @ValidateNested()
  @Type(() => PayoutDto)
  payout?: PayoutDto;
}
