-- Move roulette_player_restrictions from User.id to User.username (matches Redis / WS).

ALTER TABLE "roulette_player_restrictions" ADD COLUMN "userUsername" TEXT;

UPDATE "roulette_player_restrictions" AS r
SET "userUsername" = u."username"
FROM "User" AS u
WHERE u."id" = r."userId";

ALTER TABLE "roulette_player_restrictions" DROP CONSTRAINT "roulette_player_restrictions_userId_fkey";

DROP INDEX IF EXISTS "roulette_player_restrictions_userId_key";

ALTER TABLE "roulette_player_restrictions" DROP COLUMN "userId";

ALTER TABLE "roulette_player_restrictions" ALTER COLUMN "userUsername" SET NOT NULL;

CREATE UNIQUE INDEX "roulette_player_restrictions_userUsername_key" ON "roulette_player_restrictions"("userUsername");

ALTER TABLE "roulette_player_restrictions" ADD CONSTRAINT "roulette_player_restrictions_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
