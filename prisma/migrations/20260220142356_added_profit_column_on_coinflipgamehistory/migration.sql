/*
  Warnings:

  - Added the required column `profit` to the `CoinflipGameHistory` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CoinflipGameHistory" ADD COLUMN     "profit" DOUBLE PRECISION NOT NULL;
