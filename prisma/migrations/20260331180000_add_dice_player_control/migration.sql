-- CreateEnum
CREATE TYPE "DicePlayerControlStatus" AS ENUM ('ACTIVE', 'LIMITED', 'BANNED');

-- CreateTable
CREATE TABLE "DicePlayerControl" (
    "userUsername" TEXT NOT NULL,
    "status" "DicePlayerControlStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxBetAmount" DECIMAL(12,2),
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DicePlayerControl_pkey" PRIMARY KEY ("userUsername")
);

-- CreateIndex
CREATE INDEX "DicePlayerControl_status_idx" ON "DicePlayerControl"("status");

-- AddForeignKey
ALTER TABLE "DicePlayerControl" ADD CONSTRAINT "DicePlayerControl_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
