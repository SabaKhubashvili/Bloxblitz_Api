-- Optimize affiliate lookups: referred users by code, referred user earnings aggregation, game history by user+time.
CREATE INDEX IF NOT EXISTS "User_referedBy_idx" ON "User"("referedBy");

CREATE INDEX IF NOT EXISTS "GameHistory_username_createdAt_idx" ON "GameHistory"("username", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "ReferralLog_referrerCode_referredUsername_idx" ON "ReferralLog"("referrerCode", "referredUsername");
