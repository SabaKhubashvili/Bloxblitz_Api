-- AlterTable
ALTER TABLE "GameHistory" ADD COLUMN "rouletteGameIndex" INTEGER;

-- CreateIndex
CREATE INDEX "GameHistory_rouletteGameIndex_idx" ON "GameHistory"("rouletteGameIndex");

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_rouletteGameIndex_fkey" FOREIGN KEY ("rouletteGameIndex") REFERENCES "RouletteRound"("gameIndex") ON DELETE SET NULL ON UPDATE CASCADE;
