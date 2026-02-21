-- DropForeignKey
ALTER TABLE "GameHistory" DROP CONSTRAINT "GameHistory_userUsername_fkey";

-- AlterTable
ALTER TABLE "GameHistory" DROP COLUMN "userUsername";

-- Drop the old view first to avoid column order conflict
DROP VIEW IF EXISTS unified_game_feed;

-- Recreate with new column structure
CREATE VIEW unified_game_feed AS

-- Crash game entries
SELECT
    cb.id::text             AS id,
    'CRASH'::text           AS type,
    cb."userUsername"       AS username,
    cb."betAmount"          AS "betAmount",
    cb.profit               AS profit,
    cb."createdAt"          AS "createdAt"
FROM "CrashBet" cb

UNION ALL

-- Mines game entries
SELECT
    mbh.id::text            AS id,
    'MINES'::text           AS type,
    mbh."userUsername"      AS username,
    mbh."betAmount"         AS "betAmount",
    mbh.profit              AS profit,
    mbh."createdAt"         AS "createdAt"
FROM "MinesBetHistory" mbh

UNION ALL

-- Coinflip — Player 1 perspective
SELECT
    cf.id::text             AS id,
    'COINFLIP'::text        AS type,
    cf."player1Username"    AS username,
    cf."betAmount"          AS "betAmount",
    cf."profit"             AS profit,
    cf."createdAt"          AS "createdAt"
FROM "CoinflipGameHistory" cf
WHERE cf."player1Username" IS NOT NULL

UNION ALL

-- Coinflip — Player 2 perspective
SELECT
    cf.id::text             AS id,
    'COINFLIP'::text        AS type,
    cf."player2Username"    AS username,
    cf."betAmount"          AS "betAmount",
    cf."profit"             AS profit,
    cf."createdAt"          AS "createdAt"
FROM "CoinflipGameHistory" cf
WHERE cf."player2Username" IS NOT NULL;