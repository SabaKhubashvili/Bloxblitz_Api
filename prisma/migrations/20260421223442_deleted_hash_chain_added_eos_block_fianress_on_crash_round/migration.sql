/*
  Warnings:

  - You are about to drop the column `chainId` on the `CrashRound` table. All the data in the column will be lost.
  - You are about to drop the column `clientSeed` on the `CrashRound` table. All the data in the column will be lost.
  - You are about to drop the column `gameHash` on the `CrashRound` table. All the data in the column will be lost.
  - You are about to drop the `HashChain` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[eosBlockId]` on the table `CrashRound` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[roundNumber]` on the table `CrashRound` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `eosBlockId` to the `CrashRound` table without a default value. This is not possible if the table is not empty.
  - Added the required column `eosBlockNum` to the `CrashRound` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nonce` to the `CrashRound` table without a default value. This is not possible if the table is not empty.
  - Added the required column `serverSeed` to the `CrashRound` table without a default value. This is not possible if the table is not empty.

*/
-- unified_game_feed references CrashRound columns we are dropping; remove the view first.
DROP VIEW IF EXISTS unified_game_feed;

-- DropForeignKey (IF EXISTS: partial runs or legacy DBs may already have dropped this)
ALTER TABLE "CrashRound" DROP CONSTRAINT IF EXISTS "CrashRound_chainId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "CrashRound_chainId_roundNumber_idx";

-- DropIndex
DROP INDEX IF EXISTS "CrashRound_chainId_roundNumber_key";

-- DropIndex
DROP INDEX IF EXISTS "CrashRound_gameHash_idx";

-- DropIndex
DROP INDEX IF EXISTS "CrashRound_gameHash_key";

-- AlterTable: drop old fairness columns if still present; add EOS columns if missing (re-runnable)
ALTER TABLE "CrashRound" DROP COLUMN IF EXISTS "chainId",
DROP COLUMN IF EXISTS "clientSeed",
DROP COLUMN IF EXISTS "gameHash";

ALTER TABLE "CrashRound" ADD COLUMN IF NOT EXISTS "eosBlockId" VARCHAR(64);
ALTER TABLE "CrashRound" ADD COLUMN IF NOT EXISTS "eosBlockNum" INTEGER;
ALTER TABLE "CrashRound" ADD COLUMN IF NOT EXISTS "nonce" INTEGER;
ALTER TABLE "CrashRound" ADD COLUMN IF NOT EXISTS "serverSeed" VARCHAR(128);

ALTER TABLE "CrashRound"
  ALTER COLUMN "eosBlockId" SET NOT NULL,
  ALTER COLUMN "eosBlockNum" SET NOT NULL,
  ALTER COLUMN "nonce" SET NOT NULL,
  ALTER COLUMN "serverSeed" SET NOT NULL;

-- DropTable
DROP TABLE IF EXISTS "HashChain";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CrashRound_eosBlockId_key" ON "CrashRound"("eosBlockId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrashRound_roundNumber_idx" ON "CrashRound"("roundNumber" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CrashRound_eosBlockNum_idx" ON "CrashRound"("eosBlockNum");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CrashRound_roundNumber_key" ON "CrashRound"("roundNumber");

-- Recreate unified_game_feed (CRASH fairness uses EOS block + server seed + nonce).
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
            'eos_block_id',  cr."eosBlockId",
            'eos_block_num', cr."eosBlockNum",
            'round_number',  cr."roundNumber",
            'crash_point',   cr."crashPoint",
            'server_seed',   cr."serverSeed",
            'nonce',         cr."nonce"
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
