-- DropIndex
DROP INDEX "DiceBet_createdAt_idx";

-- CreateIndex
CREATE INDEX "DiceBet_createdAt_idx" ON "DiceBet"("createdAt" DESC);
