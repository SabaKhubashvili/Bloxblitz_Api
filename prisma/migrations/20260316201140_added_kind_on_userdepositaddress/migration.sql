/*
  Warnings:

  - Added the required column `kind` to the `UserDepositAddress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserDepositAddress" ADD COLUMN     "kind" TEXT NOT NULL;
