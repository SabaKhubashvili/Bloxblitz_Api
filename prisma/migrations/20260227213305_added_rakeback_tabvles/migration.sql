-- CreateEnum
CREATE TYPE "RakebackType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "UserRakeback" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "dailyAccrued" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "weeklyAccrued" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlyAccrued" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dailyClaimable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "weeklyClaimable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "monthlyClaimable" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "dailyUnlocksAt" TIMESTAMP(3),
    "weeklyUnlocksAt" TIMESTAMP(3),
    "weeklyExpiresAt" TIMESTAMP(3),
    "monthlyUnlocksAt" TIMESTAMP(3),
    "monthlyExpiresAt" TIMESTAMP(3),
    "lastDailyClaim" TIMESTAMP(3),
    "lastWeeklyClaim" TIMESTAMP(3),
    "lastMonthlyClaim" TIMESTAMP(3),
    "dailyStreak" INTEGER NOT NULL DEFAULT 0,
    "dailyLongestStreak" INTEGER NOT NULL DEFAULT 0,
    "dailyLastStreakDate" TIMESTAMP(3),
    "dailyStreakMultiplier" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "weeklyStreak" INTEGER NOT NULL DEFAULT 0,
    "weeklyLongestStreak" INTEGER NOT NULL DEFAULT 0,
    "weeklyLastStreakDate" TIMESTAMP(3),
    "weeklyStreakMultiplier" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "monthlyStreak" INTEGER NOT NULL DEFAULT 0,
    "monthlyLongestStreak" INTEGER NOT NULL DEFAULT 0,
    "monthlyLastStreakDate" TIMESTAMP(3),
    "monthlyStreakMultiplier" DECIMAL(5,4) NOT NULL DEFAULT 0.05,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserRakeback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RakebackClaimLog" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "type" "RakebackType" NOT NULL,
    "amountClaimed" DECIMAL(12,2) NOT NULL,
    "streakDay" INTEGER NOT NULL,
    "streakBonus" DECIMAL(5,4) NOT NULL,
    "streakReset" BOOLEAN NOT NULL DEFAULT false,
    "balanceBefore" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RakebackClaimLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserRakeback_userUsername_key" ON "UserRakeback"("userUsername");

-- CreateIndex
CREATE INDEX "UserRakeback_userUsername_idx" ON "UserRakeback"("userUsername");

-- CreateIndex
CREATE INDEX "RakebackClaimLog_userUsername_idx" ON "RakebackClaimLog"("userUsername");

-- CreateIndex
CREATE INDEX "RakebackClaimLog_type_claimedAt_idx" ON "RakebackClaimLog"("type", "claimedAt" DESC);

-- AddForeignKey
ALTER TABLE "UserRakeback" ADD CONSTRAINT "UserRakeback_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RakebackClaimLog" ADD CONSTRAINT "RakebackClaimLog_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "UserRakeback"("userUsername") ON DELETE CASCADE ON UPDATE CASCADE;
