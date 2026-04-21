import { IsIn } from 'class-validator';

const STATS_RANGES = [
  '1d',
  '7d',
  '21d',
  '30d',
  '60d',
  '90d',
  '120d',
] as const;

export type AffiliateStatsRangeParam = (typeof STATS_RANGES)[number];

export class AffiliateStatsQueryDto {
  @IsIn([...STATS_RANGES])
  range!: AffiliateStatsRangeParam;
}
