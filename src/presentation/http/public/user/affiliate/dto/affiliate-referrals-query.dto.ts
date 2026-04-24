import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum AffiliateReferralsRangeParam {
  ALL = 'all',
  D7 = '7d',
  D30 = '30d',
  D90 = '90d',
}

export class AffiliateReferralsQueryDto {
  @IsOptional()
  @IsEnum(AffiliateReferralsRangeParam)
  range: AffiliateReferralsRangeParam = AffiliateReferralsRangeParam.ALL;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
