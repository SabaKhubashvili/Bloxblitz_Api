/*
  Warnings:

  - You are about to drop the column `userId` on the `RaceParticipant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[raceId,userUsername]` on the table `RaceParticipant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userUsername` to the `RaceParticipant` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "RaceParticipant" DROP CONSTRAINT "RaceParticipant_userId_fkey";

-- DropIndex
DROP INDEX "RaceParticipant_raceId_userId_key";

-- DropIndex
DROP INDEX "RaceParticipant_userId_idx";

-- AlterTable
ALTER TABLE "RaceParticipant" DROP COLUMN "userId",
ADD COLUMN     "userUsername" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "RaceParticipant_userUsername_idx" ON "RaceParticipant"("userUsername");

-- CreateIndex
CREATE UNIQUE INDEX "RaceParticipant_raceId_userUsername_key" ON "RaceParticipant"("raceId", "userUsername");

-- AddForeignKey
ALTER TABLE "RaceParticipant" ADD CONSTRAINT "RaceParticipant_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
