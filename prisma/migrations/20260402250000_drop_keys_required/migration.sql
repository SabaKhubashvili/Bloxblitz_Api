-- Each reward case now always requires exactly 1 key to open.
-- The keysRequired column is no longer needed.
ALTER TABLE "reward_case_definitions"
  DROP COLUMN IF EXISTS "keysRequired";
