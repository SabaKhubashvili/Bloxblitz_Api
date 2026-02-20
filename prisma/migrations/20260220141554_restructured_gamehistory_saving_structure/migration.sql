/*
  Warnings:

  - You are about to drop the column `player1Items` on the `CoinflipGameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `player2Items` on the `CoinflipGameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `betAmount` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `clientSeed` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `duration` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `finalMultiplier` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `gameConfig` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `gameData` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `gameId` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `nonce` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `outcome` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `payout` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `profit` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `serverSeedHash` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `startedAt` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `userUsername` on the `GameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `referedByMm2` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `CoinflipGameProvablyFairity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Mm2Bot` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Mm2CoinflipGameHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Mm2CoinflipGameProvablyFairity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Mm2Giveaway` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Mm2GiveawayEntry` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Mm2Item` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReferralLogMm2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ReferralMm2` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserInventoryMm2` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "GameType" ADD VALUE 'COINFLIP';
ALTER TYPE "GameType" ADD VALUE 'JACKPOT';

-- DropForeignKey
ALTER TABLE "CoinflipGameHistory" DROP CONSTRAINT "CoinflipGameHistory_player1Username_fkey";

-- DropForeignKey
ALTER TABLE "CoinflipGameHistory" DROP CONSTRAINT "CoinflipGameHistory_player2Username_fkey";

-- DropForeignKey
ALTER TABLE "CoinflipGameProvablyFairity" DROP CONSTRAINT "CoinflipGameProvablyFairity_gameId_fkey";

-- DropForeignKey
ALTER TABLE "GameHistory" DROP CONSTRAINT "GameHistory_userUsername_fkey";

-- DropForeignKey
ALTER TABLE "Mm2CoinflipGameHistory" DROP CONSTRAINT "Mm2CoinflipGameHistory_player1Username_fkey";

-- DropForeignKey
ALTER TABLE "Mm2CoinflipGameHistory" DROP CONSTRAINT "Mm2CoinflipGameHistory_player2Username_fkey";

-- DropForeignKey
ALTER TABLE "Mm2CoinflipGameProvablyFairity" DROP CONSTRAINT "Mm2CoinflipGameProvablyFairity_gameId_fkey";

-- DropForeignKey
ALTER TABLE "Mm2Giveaway" DROP CONSTRAINT "Mm2Giveaway_itemId_fkey";

-- DropForeignKey
ALTER TABLE "Mm2Giveaway" DROP CONSTRAINT "Mm2Giveaway_winnerUsername_fkey";

-- DropForeignKey
ALTER TABLE "Mm2GiveawayEntry" DROP CONSTRAINT "Mm2GiveawayEntry_giveawayId_fkey";

-- DropForeignKey
ALTER TABLE "Mm2GiveawayEntry" DROP CONSTRAINT "Mm2GiveawayEntry_userUsername_fkey";

-- DropForeignKey
ALTER TABLE "ReferralLogMm2" DROP CONSTRAINT "ReferralLogMm2_referredUsername_fkey";

-- DropForeignKey
ALTER TABLE "ReferralLogMm2" DROP CONSTRAINT "ReferralLogMm2_referrerCode_fkey";

-- DropForeignKey
ALTER TABLE "ReferralMm2" DROP CONSTRAINT "ReferralMm2_userUsername_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_referedByMm2_fkey";

-- DropForeignKey
ALTER TABLE "UserInventoryMm2" DROP CONSTRAINT "UserInventoryMm2_itemId_fkey";

-- DropForeignKey
ALTER TABLE "UserInventoryMm2" DROP CONSTRAINT "UserInventoryMm2_owner_bot_id_fkey";

-- DropForeignKey
ALTER TABLE "UserInventoryMm2" DROP CONSTRAINT "UserInventoryMm2_userUsername_fkey";

-- DropIndex
DROP INDEX "GameHistory_gameId_key";

-- DropIndex
DROP INDEX "GameHistory_nonce_idx";

-- DropIndex
DROP INDEX "GameHistory_outcome_idx";

-- DropIndex
DROP INDEX "GameHistory_serverSeedHash_idx";

-- DropIndex
DROP INDEX "GameHistory_userUsername_idx";

-- DropIndex
DROP INDEX "GameHistory_userUsername_startedAt_idx";

-- AlterTable
ALTER TABLE "CoinflipGameHistory" DROP COLUMN "player1Items",
DROP COLUMN "player2Items";

-- AlterTable
ALTER TABLE "GameHistory" DROP COLUMN "betAmount",
DROP COLUMN "clientSeed",
DROP COLUMN "completedAt",
DROP COLUMN "duration",
DROP COLUMN "finalMultiplier",
DROP COLUMN "gameConfig",
DROP COLUMN "gameData",
DROP COLUMN "gameId",
DROP COLUMN "nonce",
DROP COLUMN "outcome",
DROP COLUMN "payout",
DROP COLUMN "profit",
DROP COLUMN "serverSeedHash",
DROP COLUMN "startedAt",
DROP COLUMN "userUsername",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "referedByMm2";

-- DropTable
DROP TABLE "CoinflipGameProvablyFairity";

-- DropTable
DROP TABLE "Mm2Bot";

-- DropTable
DROP TABLE "Mm2CoinflipGameHistory";

-- DropTable
DROP TABLE "Mm2CoinflipGameProvablyFairity";

-- DropTable
DROP TABLE "Mm2Giveaway";

-- DropTable
DROP TABLE "Mm2GiveawayEntry";

-- DropTable
DROP TABLE "Mm2Item";

-- DropTable
DROP TABLE "ReferralLogMm2";

-- DropTable
DROP TABLE "ReferralMm2";

-- DropTable
DROP TABLE "UserInventoryMm2";

-- CreateTable
CREATE TABLE "MinesBetHistory" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "betAmount" DECIMAL(12,2) NOT NULL,
    "tilesOpened" INTEGER NOT NULL,
    "minesHit" INTEGER NOT NULL,
    "profit" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MinesBetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnlinePlayerFairness" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "serverSeed" VARCHAR(128) NOT NULL,
    "serverSeedHash" VARCHAR(64) NOT NULL,
    "clientSeed" VARCHAR(64) NOT NULL,
    "eosBlockNumber" INTEGER NOT NULL,
    "eosBlockId" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnlinePlayerFairness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MinesBetHistory_gameId_key" ON "MinesBetHistory"("gameId");

-- CreateIndex
CREATE INDEX "MinesBetHistory_userUsername_idx" ON "MinesBetHistory"("userUsername");

-- CreateIndex
CREATE INDEX "MinesBetHistory_createdAt_idx" ON "MinesBetHistory"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "MinesBetHistory_gameId_idx" ON "MinesBetHistory"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "OnlinePlayerFairness_gameId_key" ON "OnlinePlayerFairness"("gameId");

-- CreateIndex
CREATE INDEX "OnlinePlayerFairness_gameType_idx" ON "OnlinePlayerFairness"("gameType");

-- CreateIndex
CREATE INDEX "OnlinePlayerFairness_serverSeedHash_idx" ON "OnlinePlayerFairness"("serverSeedHash");

-- AddForeignKey
ALTER TABLE "CoinflipGameHistory" ADD CONSTRAINT "CoinflipGameHistory_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "OnlinePlayerFairness"("gameId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashBet" ADD CONSTRAINT "CrashBet_id_fkey" FOREIGN KEY ("id") REFERENCES "OnlinePlayerFairness"("gameId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinesBetHistory" ADD CONSTRAINT "MinesBetHistory_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
