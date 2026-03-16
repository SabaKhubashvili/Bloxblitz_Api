/*
  Warnings:

  - Added the required column `profileId` to the `UserDepositAddress` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "UserDepositAddress" ADD COLUMN     "profileId" TEXT NOT NULL;
