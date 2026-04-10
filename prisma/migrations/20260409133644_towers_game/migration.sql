-- CreateEnum
CREATE TYPE "TowersGameStatus" AS ENUM ('ACTIVE', 'LOST', 'CASHED_OUT', 'COMPLETED');

-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'TOWERS';

-- CreateTable
CREATE TABLE "TowersGameHistory" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "difficulty" VARCHAR(16) NOT NULL,
    "levels" INTEGER NOT NULL,
    "rowConfigs" JSONB NOT NULL,
    "status" "TowersGameStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentRowIndex" INTEGER NOT NULL DEFAULT 0,
    "currentMultiplier" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "picks" JSONB NOT NULL,
    "multiplierLadder" JSONB NOT NULL,
    "serverSeed" VARCHAR(128) NOT NULL,
    "serverSeedHash" VARCHAR(64) NOT NULL,
    "clientSeed" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TowersGameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TowersGameHistory_gameId_key" ON "TowersGameHistory"("gameId");

-- CreateIndex
CREATE INDEX "TowersGameHistory_gameId_idx" ON "TowersGameHistory"("gameId");

-- CreateIndex
CREATE INDEX "TowersGameHistory_status_createdAt_idx" ON "TowersGameHistory"("status", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "TowersGameHistory" ADD CONSTRAINT "TowersGameHistory_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
