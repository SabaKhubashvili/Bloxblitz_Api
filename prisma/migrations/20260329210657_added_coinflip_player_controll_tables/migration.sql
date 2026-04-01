-- CreateEnum
CREATE TYPE "CoinflipPlayerControlStatus" AS ENUM ('ACTIVE', 'LIMITED', 'BANNED');

-- CreateTable
CREATE TABLE "CoinflipPlayerControl" (
    "userUsername" TEXT NOT NULL,
    "status" "CoinflipPlayerControlStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxWagerAmount" DECIMAL(12,2),
    "maxGamesPerHour" INTEGER,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinflipPlayerControl_pkey" PRIMARY KEY ("userUsername")
);

-- CreateIndex
CREATE INDEX "CoinflipPlayerControl_status_idx" ON "CoinflipPlayerControl"("status");

-- CreateIndex
CREATE INDEX "case_open_history_caseId_createdAt_idx" ON "case_open_history"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "CoinflipPlayerControl" ADD CONSTRAINT "CoinflipPlayerControl_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
