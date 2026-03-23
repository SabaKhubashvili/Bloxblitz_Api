import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { CaseListQueryFilter } from '../../../../../../domain/game/case/services/case-list-query.policy';

export class ListCasesQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  riskMin?: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  riskMax?: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsIn(['price'])
  sortBy?: 'price';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(['amp', 'mm2'])
  category?: 'amp' | 'mm2';
}

export function toCaseListQueryFilter(dto: ListCasesQueryDto): CaseListQueryFilter {
  const out: CaseListQueryFilter = {};

  let minP = dto.minPrice;
  let maxP = dto.maxPrice;
  if (minP !== undefined && maxP !== undefined && minP > maxP) {
    const t = minP;
    minP = maxP;
    maxP = t;
  }
  if (minP !== undefined) out.minPrice = minP;
  if (maxP !== undefined) out.maxPrice = maxP;

  if (dto.riskMin !== undefined) out.riskMin = dto.riskMin;
  if (dto.riskMax !== undefined) out.riskMax = dto.riskMax;

  if (dto.search !== undefined) {
    const s = dto.search.trim();
    if (s.length > 0) out.search = s;
  }

  if (dto.category !== undefined) out.category = dto.category;

  if (dto.sortBy === 'price') {
    out.sortBy = 'price';
    out.order = dto.order ?? 'asc';
  }

  return out;
}
