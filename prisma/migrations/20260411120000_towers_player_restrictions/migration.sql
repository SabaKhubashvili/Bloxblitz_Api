-- CreateTable
CREATE TABLE "towers_player_restrictions" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "dailyWagerLimit" DOUBLE PRECISION,
    "weeklyWagerLimit" DOUBLE PRECISION,
    "monthlyWagerLimit" DOUBLE PRECISION,
    "limitReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "towers_player_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "towers_player_restrictions_userUsername_key" ON "towers_player_restrictions"("userUsername");

-- CreateIndex
CREATE INDEX "towers_player_restrictions_userUsername_idx" ON "towers_player_restrictions"("userUsername");

-- AddForeignKey
ALTER TABLE "towers_player_restrictions" ADD CONSTRAINT "towers_player_restrictions_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
