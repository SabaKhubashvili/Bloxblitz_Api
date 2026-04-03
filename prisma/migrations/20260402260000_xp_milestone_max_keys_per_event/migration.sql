-- Add per-case cap on how many keys a single XP-milestone event can grant.
-- Default of 10 matches the existing wagerKeysMaxPerEvent convention.
ALTER TABLE "reward_case_definitions"
  ADD COLUMN IF NOT EXISTS "xpMilestoneMaxKeysPerEvent" INTEGER NOT NULL DEFAULT 10;
