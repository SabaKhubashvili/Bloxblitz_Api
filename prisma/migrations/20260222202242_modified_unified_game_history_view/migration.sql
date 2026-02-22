
DROP VIEW IF EXISTS unified_game_feed;

CREATE OR REPLACE VIEW unified_game_feed AS
SELECT
    gh.id::text             AS id,
    gh."gameType"::text     AS game_type,
    gh.username             AS username,
    gh."betAmount"          AS bet_amount,
    gh.profit               AS profit,
    gh.multiplier           AS multiplier,
    gh.status               AS status,
    gh."createdAt"          AS created_at,

    CASE gh."gameType"
        WHEN 'MINES' THEN jsonb_build_object(
            'grid_size',        mb."gridSize",
            'mines_count',      mb."minesCount",
            'revealed_tiles',   mb."revealedTiles",
            'mine_positions',   mb."minePositions",
            'cashout_tile',     mb."cashoutTile",
            'mines_hit',        mb."minesHit"
        )
        WHEN 'CRASH' THEN jsonb_build_object(
            'round_id',         cb."roundId",
            'cashout_at',       cb."cashoutAt",
            'auto_cashout',     cb."autoCashout",
            'did_cashout',      cb."didCashout"
        )
        WHEN 'COINFLIP' THEN jsonb_build_object(
            'player1',          cfg."player1Username",
            'player2',          cfg."player2Username",
            'winner_side',      cfg."winnerSide",
            'player1_side',     cfg."player1Side"
        )
        ELSE '{}'::jsonb
    END                     AS game_data

FROM "GameHistory" gh

LEFT JOIN "MinesBetHistory" mb
    ON mb."gameId" = gh.id
    AND gh."gameType" = 'MINES'

LEFT JOIN "CrashBet" cb
    ON cb."gameId" = gh.id
    AND gh."gameType" = 'CRASH'

LEFT JOIN "CoinflipGameHistory" cfg
    ON cfg."gameId" = gh.id
    AND gh."gameType" = 'COINFLIP';