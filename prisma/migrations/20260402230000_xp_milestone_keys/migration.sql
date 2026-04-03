-- Migration: xp_milestone_keys
-- Adds per-case XP milestone threshold, the XP_MILESTONE key source, and a
-- progress-tracking table so the system knows how many keys each user has
-- already received for each case.

-- 1. Extend the key-source enum
ALTER TYPE "UserRewardKeySource" ADD VALUE IF NOT EXISTS 'XP_MILESTONE';

-- 2. Add per-case XP threshold column (null = feature disabled for that case)
ALTER TABLE "reward_case_definitions"
  ADD COLUMN IF NOT EXISTS "xpMilestoneThreshold" INTEGER;

-- 3. Create the milestone progress tracking table
CREATE TABLE IF NOT EXISTS "reward_case_milestone_progress" (
    "id"           TEXT         NOT NULL,
    "userUsername" TEXT         NOT NULL,
    "rewardCaseId" TEXT         NOT NULL,
    "keysGranted"  INTEGER      NOT NULL DEFAULT 0,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_case_milestone_progress_pkey" PRIMARY KEY ("id")
);

-- 4. Foreign keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reward_case_milestone_progress_userUsername_fkey') THEN
    ALTER TABLE "reward_case_milestone_progress"
      ADD CONSTRAINT "reward_case_milestone_progress_userUsername_fkey"
        FOREIGN KEY ("userUsername")
        REFERENCES "User"("username")
        ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reward_case_milestone_progress_rewardCaseId_fkey') THEN
    ALTER TABLE "reward_case_milestone_progress"
      ADD CONSTRAINT "reward_case_milestone_progress_rewardCaseId_fkey"
        FOREIGN KEY ("rewardCaseId")
        REFERENCES "reward_case_definitions"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Unique constraint (one tracker row per user+case pair)
CREATE UNIQUE INDEX IF NOT EXISTS "reward_case_milestone_progress_userUsername_rewardCaseId_key"
  ON "reward_case_milestone_progress"("userUsername", "rewardCaseId");

-- 6. Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS "reward_case_milestone_progress_userUsername_idx"
  ON "reward_case_milestone_progress"("userUsername");
