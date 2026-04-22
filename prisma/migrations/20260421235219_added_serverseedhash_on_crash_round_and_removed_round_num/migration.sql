/*
  Warnings:

  - You are about to drop the column `roundNumber` on the `CrashRound` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nonce]` on the table `CrashRound` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `serverSeedHash` to the `CrashRound` table without a default value. This is not possible if the table is not empty.

*/
-- View references CrashRound.roundNumber; drop before altering the table.
DROP VIEW IF EXISTS unified_game_feed;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- DropIndex
DROP INDEX IF EXISTS "CrashRound_roundNumber_idx";

-- DropIndex
DROP INDEX IF EXISTS "CrashRound_roundNumber_key";

-- DropIndex
DROP INDEX IF EXISTS "KinguinCodeBatch_batchName_idx";

-- AlterTable: add hash, backfill from server seed (UTF-8, hex digest — matches app provably-fair hash), then drop roundNumber.
ALTER TABLE "CrashRound" ADD COLUMN "serverSeedHash" VARCHAR(64);

UPDATE "CrashRound"
SET "serverSeedHash" = encode(digest(convert_to("serverSeed", 'UTF8'), 'sha256'), 'hex')
WHERE "serverSeedHash" IS NULL;

ALTER TABLE "CrashRound"
  ALTER COLUMN "serverSeedHash" SET NOT NULL,
  DROP COLUMN "roundNumber";

-- CreateIndex
CREATE INDEX "CrashRound_nonce_idx" ON "CrashRound"("nonce" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CrashRound_nonce_key" ON "CrashRound"("nonce");

-- Recreate unified_game_feed (CRASH: no roundNumber; expose server_seed_hash).
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
            'eos_block_id',     cr."eosBlockId",
            'eos_block_num',    cr."eosBlockNum",
            'crash_point',      cr."crashPoint",
            'server_seed',      cr."serverSeed",
            'server_seed_hash', cr."serverSeedHash",
            'nonce',            cr."nonce"
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
