-- CreateEnum
CREATE TYPE "MinesPlayerControlStatus" AS ENUM ('ACTIVE', 'LIMITED', 'BANNED');

-- CreateTable
CREATE TABLE "MinesPlayerControl" (
    "userUsername" TEXT NOT NULL,
    "status" "MinesPlayerControlStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxBetAmount" DECIMAL(12,2),
    "maxGamesPerHour" INTEGER,
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MinesPlayerControl_pkey" PRIMARY KEY ("userUsername")
);

-- CreateIndex
CREATE INDEX "MinesPlayerControl_status_idx" ON "MinesPlayerControl"("status");

-- CreateIndex
CREATE INDEX "MinesPlayerControl_userUsername_idx" ON "MinesPlayerControl"("userUsername");

-- AddForeignKey
ALTER TABLE "MinesPlayerControl" ADD CONSTRAINT "MinesPlayerControl_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
