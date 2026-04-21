/*
  Warnings:

  - You are about to drop the column `referralMm2Id` on the `ReferralLog` table. All the data in the column will be lost.
  - Changed the type of `game` on the `ReferralLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "ReferralLog" DROP COLUMN "referralMm2Id",
DROP COLUMN "game",
ADD COLUMN     "game" "GameType" NOT NULL;

-- AlterTable
ALTER TABLE "TowersGameHistory" ALTER COLUMN "nonce" DROP DEFAULT;
