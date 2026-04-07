-- CreateEnum
CREATE TYPE "RouletteColor" AS ENUM ('GREEN', 'BROWN', 'YELLOW');

-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'ROULETTE';

-- CreateTable
CREATE TABLE "RouletteRound" (
    "id" TEXT NOT NULL,
    "gameIndex" INTEGER NOT NULL,
    "serverSeed" VARCHAR(128) NOT NULL,
    "eosBlockId" VARCHAR(64) NOT NULL,
    "outcomeHash" VARCHAR(64) NOT NULL,
    "outcome" "RouletteColor" NOT NULL,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RouletteRound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouletteRound_gameIndex_key" ON "RouletteRound"("gameIndex");

-- CreateIndex
CREATE INDEX "RouletteRound_gameIndex_idx" ON "RouletteRound"("gameIndex" DESC);

-- CreateIndex
CREATE INDEX "RouletteRound_createdAt_idx" ON "RouletteRound"("createdAt" DESC);
