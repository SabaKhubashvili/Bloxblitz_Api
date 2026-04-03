-- These columns were added to a reward_case_definitions table that already existed on
-- the production database. On a fresh database the columns are included directly in the
-- CREATE TABLE statement of 20260402143000_reward_case_system, so this migration is a
-- safe no-op when the table does not yet exist.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reward_case_definitions'
  ) THEN
    ALTER TABLE "reward_case_definitions"
      ADD COLUMN IF NOT EXISTS "isActive"             BOOLEAN NOT NULL DEFAULT true,
      ADD COLUMN IF NOT EXISTS "levelUpKeysOverride"  INTEGER,
      ADD COLUMN IF NOT EXISTS "receivesWagerKeys"    BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "wagerCoinsPerKey"     INTEGER NOT NULL DEFAULT 100,
      ADD COLUMN IF NOT EXISTS "wagerKeysMaxPerEvent" INTEGER NOT NULL DEFAULT 10;
  END IF;
END $$;
