-- CreateIndex
CREATE INDEX "TransactionHistory_userUsername_createdAt_idx" ON "TransactionHistory"("userUsername", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TransactionHistory_userUsername_category_idx" ON "TransactionHistory"("userUsername", "category");

-- CreateIndex
CREATE INDEX "TransactionHistory_userUsername_direction_idx" ON "TransactionHistory"("userUsername", "direction");
