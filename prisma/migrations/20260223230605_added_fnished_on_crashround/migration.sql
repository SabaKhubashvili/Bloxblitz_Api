-- AlterTable
ALTER TABLE "CrashRound" ADD COLUMN     "finished" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "finishedAt" TIMESTAMP(3);
