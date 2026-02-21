/*
  Warnings:

  - A unique constraint covering the columns `[gameId]` on the table `CrashBet` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `gameId` to the `CrashBet` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CrashBet" DROP CONSTRAINT "CrashBet_parentHistory_fkey";

-- AlterTable
ALTER TABLE "CrashBet" ADD COLUMN     "gameId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "CrashBet_gameId_key" ON "CrashBet"("gameId");

-- AddForeignKey
ALTER TABLE "CrashBet" ADD CONSTRAINT "CrashBet_parentHistory_fkey" FOREIGN KEY ("gameId") REFERENCES "GameHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
