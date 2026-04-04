-- Adds requiredLevel to reward_case_definitions.
-- Cases default to 0 (no restriction), preserving existing behaviour.
ALTER TABLE "reward_case_definitions" ADD COLUMN IF NOT EXISTS "requiredLevel" INTEGER NOT NULL DEFAULT 0;
