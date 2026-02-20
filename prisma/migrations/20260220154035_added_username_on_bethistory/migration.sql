/*
  Warnings:

  - Added the required column `userUsername` to the `GameHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "GameHistory" ADD COLUMN     "userUsername" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
