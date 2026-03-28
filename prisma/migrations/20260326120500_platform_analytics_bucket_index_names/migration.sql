-- RenameIndex: Postgres truncates identifiers to 63 chars. Safe if already renamed (e.g. old 05410 migration).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'platform_analytics_buckets'
      AND indexname = 'platform_analytics_buckets_gameType_granularity_period_start_id'
  ) THEN
    ALTER INDEX "platform_analytics_buckets_gameType_granularity_period_start_id" RENAME TO "platform_analytics_buckets_gameType_granularity_period_star_idx";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'platform_analytics_buckets'
      AND indexname = 'platform_analytics_buckets_gameType_period_start_granularity_ke'
  ) THEN
    ALTER INDEX "platform_analytics_buckets_gameType_period_start_granularity_ke" RENAME TO "platform_analytics_buckets_gameType_period_start_granularit_key";
  END IF;
END $$;
