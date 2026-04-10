-- Coinflip bot users: flag + JSON config (hydrated to Redis `coinflip:bots` by API).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "botConfig" JSONB;

CREATE INDEX IF NOT EXISTS "User_isBot_idx" ON "User"("isBot");
