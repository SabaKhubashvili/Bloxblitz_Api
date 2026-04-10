-- CreateEnum
CREATE TYPE "RestrictionTimeframe" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY');

-- CreateTable
CREATE TABLE "roulette_player_restrictions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "maxWagerAmount" DOUBLE PRECISION,
    "timeframe" "RestrictionTimeframe",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roulette_player_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roulette_player_restrictions_userId_key" ON "roulette_player_restrictions"("userId");

-- AddForeignKey
ALTER TABLE "roulette_player_restrictions" ADD CONSTRAINT "roulette_player_restrictions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
