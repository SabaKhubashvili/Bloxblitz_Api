-- Replace JSON items column with normalized pool rows (pets + Variant[] + weight).

-- 1. Create the normalized pool table
CREATE TABLE IF NOT EXISTS "reward_case_items" (
    "id"           TEXT        NOT NULL,
    "rewardCaseId" TEXT        NOT NULL,
    "petId"        INTEGER     NOT NULL,
    "weight"       INTEGER     NOT NULL,
    "sortOrder"    INTEGER     NOT NULL DEFAULT 0,
    "variant"      "Variant"[] DEFAULT ARRAY[]::"Variant"[],

    CONSTRAINT "reward_case_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "reward_case_items_rewardCaseId_idx" ON "reward_case_items"("rewardCaseId");
CREATE INDEX IF NOT EXISTS "reward_case_items_petId_idx"        ON "reward_case_items"("petId");

-- 2. Foreign keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reward_case_items_rewardCaseId_fkey') THEN
    ALTER TABLE "reward_case_items" ADD CONSTRAINT "reward_case_items_rewardCaseId_fkey"
      FOREIGN KEY ("rewardCaseId") REFERENCES "reward_case_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reward_case_items_petId_fkey') THEN
    ALTER TABLE "reward_case_items" ADD CONSTRAINT "reward_case_items_petId_fkey"
      FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Seed one placeholder pool row per definition (lowest pet id) when none exist.
--    Skip if reward_case_items is already populated or if no pets exist.
INSERT INTO "reward_case_items" ("id", "rewardCaseId", "petId", "weight", "sortOrder", "variant")
SELECT gen_random_uuid(), d."id", p."id", 100, 0, ARRAY[]::"Variant"[]
FROM "reward_case_definitions" d
CROSS JOIN LATERAL (SELECT "id" FROM "pets" ORDER BY "id" ASC LIMIT 1) p
WHERE EXISTS (SELECT 1 FROM "pets" LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "reward_case_items" WHERE "rewardCaseId" = d."id");

-- 4. Drop the legacy JSON column (only if it still exists)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'reward_case_definitions'
      AND column_name  = 'items'
  ) THEN
    ALTER TABLE "reward_case_definitions" DROP COLUMN "items";
  END IF;
END $$;
