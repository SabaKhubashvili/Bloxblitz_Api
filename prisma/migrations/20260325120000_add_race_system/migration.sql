-- CreateEnum
CREATE TYPE "RaceStatus" AS ENUM ('ACTIVE', 'FINISHED');

-- CreateTable
CREATE TABLE "Race" (
    "id" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" "RaceStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalPrizePool" DECIMAL(14,2),

    CONSTRAINT "Race_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceParticipant" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wageredAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalRank" INTEGER,

    CONSTRAINT "RaceParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaceReward" (
    "id" TEXT NOT NULL,
    "raceId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "rewardAmount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "RaceReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaceParticipant_raceId_userId_key" ON "RaceParticipant"("raceId", "userId");

-- Leaderboard ordering: higher wager first; on tie, earlier updatedAt wins (ASC).
CREATE INDEX "RaceParticipant_raceId_wageredAmount_updatedAt_idx" ON "RaceParticipant"("raceId", "wageredAmount" DESC, "updatedAt" ASC);

-- CreateIndex
CREATE INDEX "RaceParticipant_userId_idx" ON "RaceParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RaceReward_raceId_position_key" ON "RaceReward"("raceId", "position");

-- CreateIndex
CREATE INDEX "RaceReward_raceId_idx" ON "RaceReward"("raceId");

-- CreateIndex
CREATE INDEX "Race_status_endTime_idx" ON "Race"("status", "endTime" DESC);

-- CreateIndex
CREATE INDEX "Race_status_startTime_idx" ON "Race"("status", "startTime" DESC);

-- AddForeignKey
ALTER TABLE "RaceParticipant" ADD CONSTRAINT "RaceParticipant_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RaceParticipant" ADD CONSTRAINT "RaceParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RaceReward" ADD CONSTRAINT "RaceReward_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE CASCADE ON UPDATE CASCADE;
