/*
  Warnings:

  - You are about to drop the column `betAmount` on the `CoinflipGameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `profit` on the `CoinflipGameHistory` table. All the data in the column will be lost.
  - You are about to drop the column `betAmount` on the `CrashBet` table. All the data in the column will be lost.
  - You are about to drop the column `payout` on the `CrashBet` table. All the data in the column will be lost.
  - You are about to drop the column `profit` on the `CrashBet` table. All the data in the column will be lost.
  - You are about to drop the column `betAmount` on the `MinesBetHistory` table. All the data in the column will be lost.
  - You are about to drop the column `profit` on the `MinesBetHistory` table. All the data in the column will be lost.
  - You are about to drop the column `tilesOpened` on the `MinesBetHistory` table. All the data in the column will be lost.
  - Added the required column `betAmount` to the `GameHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `GameHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `username` to the `GameHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gridSize` to the `MinesBetHistory` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minesCount` to the `MinesBetHistory` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
DROP VIEW IF EXISTS unified_game_feed;

CREATE TYPE "GameStatus" AS ENUM ('FINISHED', 'INITIALIZING', 'ENDING', 'WON', 'LOST', 'CASHED_OUT', 'CANCELLED', 'PLAYING');

-- AlterTable
ALTER TABLE "CoinflipGameHistory" DROP COLUMN "betAmount",
DROP COLUMN "profit";

-- AlterTable
ALTER TABLE "CrashBet" DROP COLUMN "betAmount",
DROP COLUMN "payout",
DROP COLUMN "profit";

-- AlterTable
ALTER TABLE "GameHistory" ADD COLUMN     "betAmount" DECIMAL(12,2) NOT NULL,
ADD COLUMN     "multiplier" DECIMAL(10,4),
ADD COLUMN     "profit" DECIMAL(12,2),
ADD COLUMN     "status" "GameStatus" NOT NULL,
ADD COLUMN     "username" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MinesBetHistory" DROP COLUMN "betAmount",
DROP COLUMN "profit",
DROP COLUMN "tilesOpened",
ADD COLUMN     "cashoutTile" INTEGER,
ADD COLUMN     "gridSize" INTEGER NOT NULL,
ADD COLUMN     "minePositions" INTEGER[],
ADD COLUMN     "minesCount" INTEGER NOT NULL,
ADD COLUMN     "revealedTiles" INTEGER[],
ADD COLUMN     "status" "GameStatus" NOT NULL DEFAULT 'PLAYING';

-- DropEnum
DROP TYPE "GameOutcome";

-- RenameForeignKey
ALTER TABLE "CoinflipGameHistory" RENAME CONSTRAINT "CoinflipGameHistory_gameId_fkey" TO "CoinflipGameHistory_fairness_fkey";

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_username_fkey" FOREIGN KEY ("username") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinflipGameHistory" ADD CONSTRAINT "CoinflipGameHistory_parentHistory_fkey" FOREIGN KEY ("gameId") REFERENCES "GameHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashBet" ADD CONSTRAINT "CrashBet_parentHistory_fkey" FOREIGN KEY ("id") REFERENCES "GameHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinesBetHistory" ADD CONSTRAINT "MinesBetHistory_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GameHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;



CREATE OR REPLACE VIEW unified_game_feed AS
SELECT
    gh.id::text                 AS id,
    gh."gameType"::text         AS game_type,
    gh.username                 AS username,
    gh."betAmount"              AS bet_amount,
    gh.profit                   AS profit,
    gh.multiplier               AS multiplier,
    gh.status                   AS status,
    gh."createdAt"              AS created_at
FROM "GameHistory" gh;