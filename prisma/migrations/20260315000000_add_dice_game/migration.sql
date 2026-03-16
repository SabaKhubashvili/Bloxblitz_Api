-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'DICE';

-- CreateEnum
CREATE TYPE "DiceRollMode" AS ENUM ('OVER', 'UNDER');

-- CreateTable
CREATE TABLE "DiceBet" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "betAmount" DECIMAL(12,2) NOT NULL,
    "chance" DECIMAL(5,2) NOT NULL,
    "rollMode" "DiceRollMode" NOT NULL,
    "rollResult" DECIMAL(5,2) NOT NULL,
    "multiplier" DECIMAL(10,4) NOT NULL,
    "payout" DECIMAL(12,2) NOT NULL,
    "profit" DECIMAL(12,2) NOT NULL,
    "clientSeed" VARCHAR(64) NOT NULL,
    "serverSeedHash" VARCHAR(64) NOT NULL,
    "nonce" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameHistoryId" TEXT,

    CONSTRAINT "DiceBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiceBet_userUsername_idx" ON "DiceBet"("userUsername");

-- CreateIndex
CREATE INDEX "DiceBet_createdAt_idx" ON "DiceBet"("createdAt");

-- CreateIndex
CREATE INDEX "DiceBet_userUsername_createdAt_idx" ON "DiceBet"("userUsername", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DiceBet_gameHistoryId_key" ON "DiceBet"("gameHistoryId");

-- AddForeignKey
ALTER TABLE "DiceBet" ADD CONSTRAINT "DiceBet_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiceBet" ADD CONSTRAINT "DiceBet_gameHistoryId_fkey" FOREIGN KEY ("gameHistoryId") REFERENCES "GameHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
