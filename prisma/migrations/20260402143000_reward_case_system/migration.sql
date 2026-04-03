-- Reward case catalog, per-user key ledger, and case open outcomes.
-- All DDL is idempotent so this migration is safe to apply whether or not
-- the objects already exist (handles both fresh databases and production
-- databases where the table was created before this migration was written).

-- 1. Enum (create only if it does not already exist)
DO $$ BEGIN
  CREATE TYPE "UserRewardKeySource" AS ENUM ('WAGER', 'LEVEL_UP', 'MILESTONE_RAKEBACK', 'CASE_OPEN_SPEND');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. reward_case_definitions
-- Includes the wager/activation columns from 20260402012427 so that a fresh
-- database gets the complete schema in one shot.
CREATE TABLE IF NOT EXISTS "reward_case_definitions" (
    "id"                   TEXT         NOT NULL,
    "slug"                 TEXT         NOT NULL,
    "position"             INTEGER      NOT NULL,
    "imageUrl"             TEXT         NOT NULL,
    "title"                TEXT         NOT NULL,
    "items"                JSONB        NOT NULL DEFAULT '[]'::jsonb,
    "keysRequired"         INTEGER      NOT NULL DEFAULT 1,
    "isRakebackCase"       BOOLEAN      NOT NULL DEFAULT false,
    "milestoneLevel"       INTEGER,
    "isActive"             BOOLEAN      NOT NULL DEFAULT true,
    "receivesWagerKeys"    BOOLEAN      NOT NULL DEFAULT false,
    "wagerCoinsPerKey"     INTEGER      NOT NULL DEFAULT 100,
    "wagerKeysMaxPerEvent" INTEGER      NOT NULL DEFAULT 10,
    "levelUpKeysOverride"  INTEGER,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reward_case_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "reward_case_definitions_slug_key"     ON "reward_case_definitions"("slug");
CREATE        INDEX IF NOT EXISTS "reward_case_definitions_position_idx" ON "reward_case_definitions"("position");

-- 3. user_keys
CREATE TABLE IF NOT EXISTS "user_keys" (
    "id"           TEXT                    NOT NULL,
    "userUsername" TEXT                    NOT NULL,
    "rewardCaseId" TEXT                    NOT NULL,
    "quantity"     INTEGER                 NOT NULL,
    "source"       "UserRewardKeySource"   NOT NULL,
    "referenceId"  TEXT,
    "createdAt"    TIMESTAMP(3)            NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "user_keys_userUsername_rewardCaseId_idx" ON "user_keys"("userUsername", "rewardCaseId");
CREATE INDEX IF NOT EXISTS "user_keys_userUsername_createdAt_idx"    ON "user_keys"("userUsername", "createdAt" DESC);

-- 4. reward_cases (case open outcomes)
CREATE TABLE IF NOT EXISTS "reward_cases" (
    "id"            TEXT         NOT NULL,
    "userUsername"  TEXT         NOT NULL,
    "rewardCaseId"  TEXT         NOT NULL,
    "itemsReceived" JSONB        NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reward_cases_userUsername_rewardCaseId_createdAt_idx"
    ON "reward_cases"("userUsername", "rewardCaseId", "createdAt" DESC);

-- 5. Foreign keys (skip if already present)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_keys_userUsername_fkey') THEN
    ALTER TABLE "user_keys" ADD CONSTRAINT "user_keys_userUsername_fkey"
      FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_keys_rewardCaseId_fkey') THEN
    ALTER TABLE "user_keys" ADD CONSTRAINT "user_keys_rewardCaseId_fkey"
      FOREIGN KEY ("rewardCaseId") REFERENCES "reward_case_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reward_cases_userUsername_fkey') THEN
    ALTER TABLE "reward_cases" ADD CONSTRAINT "reward_cases_userUsername_fkey"
      FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reward_cases_rewardCaseId_fkey') THEN
    ALTER TABLE "reward_cases" ADD CONSTRAINT "reward_cases_rewardCaseId_fkey"
      FOREIGN KEY ("rewardCaseId") REFERENCES "reward_case_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 6. Seed the default level/milestone tiers (skip rows that already exist)
INSERT INTO "reward_case_definitions" ("id","slug","position","imageUrl","title","items","keysRequired","isRakebackCase","milestoneLevel","createdAt","updatedAt") VALUES
('00000000-0000-4000-8000-000000000001','reward-iron',       1, '/images/case/iron.webp',   'Iron',       '[{"id":"a","label":"5 Coins","weight":55,"rewardType":"BALANCE","amount":5},{"id":"b","label":"15 Coins","weight":35,"rewardType":"BALANCE","amount":15},{"id":"c","label":"40 Coins","weight":10,"rewardType":"BALANCE","amount":40}]'::jsonb,  0, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000002','reward-bronze',     2, '/images/case/bronze.webp', 'Bronze',     '[{"id":"a","label":"10 Coins","weight":50,"rewardType":"BALANCE","amount":10},{"id":"b","label":"30 Coins","weight":35,"rewardType":"BALANCE","amount":30},{"id":"c","label":"75 Coins","weight":15,"rewardType":"BALANCE","amount":75}]'::jsonb, 5, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000003','reward-silver',     3, '/images/case/case3.webp',  'Silver',     '[{"id":"a","label":"15 Coins","weight":50,"rewardType":"BALANCE","amount":15},{"id":"b","label":"45 Coins","weight":35,"rewardType":"BALANCE","amount":45},{"id":"c","label":"120 Coins","weight":15,"rewardType":"BALANCE","amount":120}]'::jsonb,10, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000004','reward-gold',       4, '/images/case/case3.webp',  'Gold',       '[{"id":"a","label":"20 Coins","weight":50,"rewardType":"BALANCE","amount":20},{"id":"b","label":"60 Coins","weight":35,"rewardType":"BALANCE","amount":60},{"id":"c","label":"150 Coins","weight":15,"rewardType":"BALANCE","amount":150}]'::jsonb,15, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000005','reward-amethyst',   5, '/images/case/case3.webp',  'Amethyst',   '[{"id":"a","label":"25 Coins","weight":50,"rewardType":"BALANCE","amount":25},{"id":"b","label":"80 Coins","weight":35,"rewardType":"BALANCE","amount":80},{"id":"c","label":"200 Coins","weight":15,"rewardType":"BALANCE","amount":200}]'::jsonb,20, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000006','reward-sapphire',   6, '/images/case/case3.webp',  'Sapphire',   '[{"id":"a","label":"30 Coins","weight":50,"rewardType":"BALANCE","amount":30},{"id":"b","label":"100 Coins","weight":35,"rewardType":"BALANCE","amount":100},{"id":"c","label":"250 Coins","weight":15,"rewardType":"BALANCE","amount":250}]'::jsonb,25, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000007','reward-emerald',    7, '/images/case/case3.webp',  'Emerald',    '[{"id":"a","label":"40 Coins","weight":50,"rewardType":"BALANCE","amount":40},{"id":"b","label":"120 Coins","weight":35,"rewardType":"BALANCE","amount":120},{"id":"c","label":"300 Coins","weight":15,"rewardType":"BALANCE","amount":300}]'::jsonb,30, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000008','reward-topaz',      8, '/images/case/case3.webp',  'Topaz',      '[{"id":"a","label":"50 Coins","weight":50,"rewardType":"BALANCE","amount":50},{"id":"b","label":"150 Coins","weight":35,"rewardType":"BALANCE","amount":150},{"id":"c","label":"400 Coins","weight":15,"rewardType":"BALANCE","amount":400}]'::jsonb,35, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-000000000009','reward-spinel',     9, '/images/case/case3.webp',  'Spinel',     '[{"id":"a","label":"60 Coins","weight":50,"rewardType":"BALANCE","amount":60},{"id":"b","label":"180 Coins","weight":35,"rewardType":"BALANCE","amount":180},{"id":"c","label":"500 Coins","weight":15,"rewardType":"BALANCE","amount":500}]'::jsonb,40, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-00000000000a','reward-alexandrite',10,'/images/case/case3.webp',  'Alexandrite','[{"id":"a","label":"80 Coins","weight":50,"rewardType":"BALANCE","amount":80},{"id":"b","label":"250 Coins","weight":35,"rewardType":"BALANCE","amount":250},{"id":"c","label":"750 Coins","weight":15,"rewardType":"BALANCE","amount":750}]'::jsonb,50, false, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('00000000-0000-4000-8000-00000000000b','wager-rakeback',  100,'/images/case/case3.webp',  'Wager rakeback','[{"id":"a","label":"100 Coins","weight":45,"rewardType":"BALANCE","amount":100},{"id":"b","label":"250 Coins","weight":35,"rewardType":"BALANCE","amount":250},{"id":"c","label":"500 Coins","weight":15,"rewardType":"BALANCE","amount":500},{"id":"d","label":"1000 Coins","weight":5,"rewardType":"BALANCE","amount":1000}]'::jsonb,1, true,  NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
