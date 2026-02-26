CREATE OR REPLACE VIEW unified_game_feed AS

-- =====================
-- MINES
-- =====================
SELECT
    gh.id::text         AS id,
    'MINES'             AS game_type,
    gh.username,
    gh."betAmount"      AS bet_amount,
    gh.profit,
    gh.multiplier,
    gh.status,
    gh."createdAt"      AS created_at,

    jsonb_build_object(
        'grid_size',      mb."gridSize",
        'mines_count',    mb."minesCount",
        'revealed_tiles', mb."revealedTiles",
        'mine_positions', mb."minePositions",
        'cashout_tile',   mb."cashoutTile",
        'mines_hit',      mb."minesHit",
        'seed_info', jsonb_build_object(
            'server_seed_hash', srh."serverSeedHash",
            'client_seed',      srh."clientSeed",
            'server_seed',      srh."serverSeed",
            'nonce',            mb."nonce"
        )
    ) AS game_data

FROM "GameHistory" gh
JOIN "MinesBetHistory" mb
    ON mb."gameId" = gh.id
LEFT JOIN "SeedRotationHistory" srh
    ON srh."id" = gh."seedRotationHistoryId"
WHERE gh."gameType" = 'MINES'

UNION ALL

-- =====================
-- CRASH
-- =====================
SELECT
    gh.id::text,
    'CRASH',
    gh.username,
    gh."betAmount",
    gh.profit,
    gh.multiplier,
    gh.status,
    gh."createdAt",

    jsonb_build_object(
        'round_id',     cb."roundId",
        'cashout_at',   cb."cashoutAt",
        'auto_cashout', cb."autoCashout",
        'did_cashout',  cb."didCashout",
        'fairness', jsonb_build_object(
            'game_hash', cr."gameHash",
            'round_number',      cr."roundNumber",
            'crash_point',      cr."crashPoint",
            'client_seed',            cr."clientSeed"
        )
    ) as game_data

FROM "GameHistory" gh
JOIN "CrashBet" cb
    ON cb."gameId" = gh.id
INNER JOIN "CrashRound" cr
    ON cr."id" = cb."roundId" AND cr."finished" = true
WHERE gh."gameType" = 'CRASH'

UNION ALL

-- =====================
-- COINFLIP
-- =====================
SELECT
    gh.id::text,
    'COINFLIP',
    gh.username,
    gh."betAmount",
    gh.profit,
    gh.multiplier,
    gh.status,
    gh."createdAt",

    jsonb_build_object(
        'player1', jsonb_build_object(
            'username',        p1."username",
            'profile_picture', p1."profile_picture",
            'level',           p1."currentLevel"
        ),
        'player2', jsonb_build_object(
            'username',        p2."username",
            'profile_picture', p2."profile_picture",
            'level',           p2."currentLevel"
        ),
        'winner_side',  cfg."winnerSide",
        'player1_side', cfg."player1Side",
        'fairness', jsonb_build_object(
            'server_seed',      opf."serverSeed",
            'server_seed_hash', opf."serverSeedHash",
            'nonce',            opf."nonce",
            'result',           opf."result",
            'eos_block_number', opf."eosBlockNumber",
            'eos_block_id',     opf."eosBlockId"
        )
    )

FROM "GameHistory" gh
JOIN "CoinflipGameHistory" cfg
    ON cfg."gameId" = gh.id
LEFT JOIN "User" p1
    ON p1."username" = cfg."player1Username"
LEFT JOIN "User" p2
    ON p2."username" = cfg."player2Username"
LEFT JOIN "OnlinePlayerFairness" opf
    ON opf."gameId" = cfg."gameId"
WHERE gh."gameType" = 'COINFLIP';