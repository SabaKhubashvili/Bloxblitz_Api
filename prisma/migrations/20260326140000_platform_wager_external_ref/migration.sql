-- AlterTable
ALTER TABLE "platform_wager_facts" ADD COLUMN IF NOT EXISTS "external_ref" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "platform_wager_facts_external_ref_idx" ON "platform_wager_facts"("external_ref");
