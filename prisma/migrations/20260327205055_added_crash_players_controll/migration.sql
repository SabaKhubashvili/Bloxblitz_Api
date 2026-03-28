-- CreateEnum
CREATE TYPE "CrashPlayerControlStatus" AS ENUM ('ACTIVE', 'LIMITED', 'BANNED');

-- DropEnum
DROP TYPE "AnalyticsBucketGranularity";

-- CreateTable
CREATE TABLE "CrashPlayerControl" (
    "userUsername" TEXT NOT NULL,
    "status" "CrashPlayerControlStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxBetAmount" DECIMAL(12,2),
    "minSecondsBetweenBets" INTEGER,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrashPlayerControl_pkey" PRIMARY KEY ("userUsername")
);

-- CreateTable
CREATE TABLE "game_economy_configs" (
    "id" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "caseId" TEXT,
    "variantKey" TEXT,
    "houseEdge" DECIMAL(10,8) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_economy_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CrashPlayerControl_status_idx" ON "CrashPlayerControl"("status");

-- CreateIndex
CREATE INDEX "game_economy_configs_gameType_effectiveFrom_idx" ON "game_economy_configs"("gameType", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "game_economy_configs_gameType_caseId_variantKey_effectiveFr_idx" ON "game_economy_configs"("gameType", "caseId", "variantKey", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "game_economy_configs_gameType_effectiveTo_effectiveFrom_idx" ON "game_economy_configs"("gameType", "effectiveTo", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "game_economy_configs_caseId_idx" ON "game_economy_configs"("caseId");

-- CreateIndex
CREATE INDEX "CrashRound_createdAt_idx" ON "CrashRound"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "GameHistory_createdAt_idx" ON "GameHistory"("createdAt");

-- CreateIndex
CREATE INDEX "GameHistory_gameType_createdAt_idx" ON "GameHistory"("gameType", "createdAt");

-- AddForeignKey
ALTER TABLE "CrashPlayerControl" ADD CONSTRAINT "CrashPlayerControl_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_economy_configs" ADD CONSTRAINT "game_economy_configs_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
