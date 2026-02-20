CREATE OR REPLACE VIEW unified_game_feed AS
-- Crash game entries
SELECT
    cb.id AS id,
    'CRASH'::text AS type,
    cb."betAmount",
    cb.profit as profit,
    cb."createdAt" as "createdAt"
FROM "CrashBet" cb

UNION ALL

-- Mines game entries
SELECT
    mbh.id AS id,
    'MINES'::text AS type,
    mbh."betAmount",
    mbh.profit as profit,
    mbh."createdAt" as "createdAt"
FROM "MinesBetHistory" mbh

UNION ALL

-- Coinflip game entries (only player1 for simplicity)
SELECT
    cf.id::text AS id,
    'COINFLIP'::text AS type,
    cf."betAmount",
    cf."profit" as profit,
    cf."createdAt" as "createdAt"
FROM "CoinflipGameHistory" cf;