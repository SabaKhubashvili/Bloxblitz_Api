-- CreateTable: DailySpinHistory
CREATE TABLE "DailySpinHistory" (
    "id"           TEXT         NOT NULL,
    "userUsername" TEXT         NOT NULL,
    "prizeTier"    INTEGER      NOT NULL,
    "prizeAmount"  DECIMAL(12,2) NOT NULL,
    "prizeLabel"   TEXT         NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySpinHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DailySpinState
CREATE TABLE "DailySpinState" (
    "id"           TEXT         NOT NULL,
    "userUsername" TEXT         NOT NULL,
    "lastSpinAt"   TIMESTAMP(3) NOT NULL,
    "nextSpinAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailySpinState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailySpinHistory_userUsername_idx" ON "DailySpinHistory"("userUsername");

-- CreateIndex
CREATE INDEX "DailySpinHistory_createdAt_idx" ON "DailySpinHistory"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "DailySpinHistory_userUsername_createdAt_idx" ON "DailySpinHistory"("userUsername", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "DailySpinState_userUsername_key" ON "DailySpinState"("userUsername");

-- CreateIndex
CREATE INDEX "DailySpinState_userUsername_idx" ON "DailySpinState"("userUsername");

-- CreateIndex
CREATE INDEX "DailySpinState_nextSpinAt_idx" ON "DailySpinState"("nextSpinAt");

-- AddForeignKey
ALTER TABLE "DailySpinHistory"
    ADD CONSTRAINT "DailySpinHistory_userUsername_fkey"
    FOREIGN KEY ("userUsername") REFERENCES "User"("username")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySpinState"
    ADD CONSTRAINT "DailySpinState_userUsername_fkey"
    FOREIGN KEY ("userUsername") REFERENCES "User"("username")
    ON DELETE CASCADE ON UPDATE CASCADE;
