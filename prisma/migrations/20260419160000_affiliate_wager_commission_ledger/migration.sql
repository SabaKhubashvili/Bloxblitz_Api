-- CreateTable
CREATE TABLE "affiliate_wager_commission_ledger" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "bettorUsername" TEXT NOT NULL,
    "referrerUsername" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "wagerAmount" DECIMAL(10,2) NOT NULL,
    "commissionAmount" DECIMAL(10,2) NOT NULL,
    "game" "GameType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_wager_commission_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_wager_commission_ledger_idempotencyKey_key" ON "affiliate_wager_commission_ledger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "affiliate_wager_commission_ledger_referrerUsername_idx" ON "affiliate_wager_commission_ledger"("referrerUsername");

-- CreateIndex
CREATE INDEX "affiliate_wager_commission_ledger_bettorUsername_idx" ON "affiliate_wager_commission_ledger"("bettorUsername");
