-- CreateEnum
CREATE TYPE "PaymentProviders" AS ENUM ('KINGUIN', 'UNIWIRE', 'INGAME');

-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('CRYPTO', 'KINGUIN_REDEEM', 'PET', 'REFUND');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('CRYPTO', 'GIFT_CARD', 'ITEM');

-- CreateEnum
CREATE TYPE "ReferenceType" AS ENUM ('CRYPTO_TRANSACTION', 'KINGUIN_CODE', 'INVENTORY_ITEM', 'GAME_HISTORY', 'TIP_TRANSACTION');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AvailableCryptos" AS ENUM ('BTC', 'ETH', 'LTC', 'USDT', 'DOGE');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('CRASH', 'MINES');

-- CreateEnum
CREATE TYPE "GameOutcome" AS ENUM ('WON', 'LOST', 'CASHED_OUT', 'CANCELLED', 'PLAYING');

-- CreateEnum
CREATE TYPE "SeedRotationType" AS ENUM ('MANUAL', 'AUTOMATIC', 'CLIENT_SEED_CHANGE', 'SYSTEM', 'ADMIN');

-- CreateEnum
CREATE TYPE "KinguinCodeStatus" AS ENUM ('UNUSED', 'REDEEMED', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "ReferralClaimLogStatus" AS ENUM ('SUCCESS', 'PENDING', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Side" AS ENUM ('H', 'T');

-- CreateEnum
CREATE TYPE "UserInventoryItemState" AS ENUM ('WITHDRAWING', 'IDLE', 'BATTLING', 'LOCKED');

-- CreateEnum
CREATE TYPE "Variant" AS ENUM ('M', 'N', 'F', 'R');

-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('ADMIN', 'MODERATOR', 'SUPPORT', 'MEMBER', 'OWNER', 'COMMUNITY_MANAGER', 'WHALE', 'BIGFLIPPER');

-- CreateEnum
CREATE TYPE "BotTradeStatus" AS ENUM ('NONE', 'WITHDRAW_ACCEPTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "rblx_id" TEXT NOT NULL,
    "profile_picture" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "role" "UserRoles" NOT NULL DEFAULT 'MEMBER',
    "client_seed" TEXT NOT NULL,
    "last_login_ip" TEXT,
    "last_login_at" TIMESTAMP(3),
    "referedBy" TEXT,
    "referralLastUpdate" TIMESTAMP(3),
    "userStatisticsId" INTEGER,
    "referedByMm2" TEXT,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalXP" INTEGER NOT NULL DEFAULT 0,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "privateProfile" BOOLEAN NOT NULL DEFAULT false,
    "showStatistics" BOOLEAN NOT NULL DEFAULT true,
    "soundEffects" BOOLEAN NOT NULL DEFAULT true,
    "soundVolume" INTEGER NOT NULL DEFAULT 70,
    "animations" BOOLEAN NOT NULL DEFAULT true,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserStatistics" (
    "id" SERIAL NOT NULL,
    "userUsername" TEXT NOT NULL,
    "totalWagered" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalWageredMm2" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalDeposits" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalWithdrawals" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalLoss" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalGamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "totalGamesWon" INTEGER NOT NULL DEFAULT 0,
    "totalGamesLost" INTEGER NOT NULL DEFAULT 0,
    "coinflipsWon" INTEGER NOT NULL DEFAULT 0,
    "coinflipsLost" INTEGER NOT NULL DEFAULT 0,
    "crashGamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "minesGamesPlayed" INTEGER NOT NULL DEFAULT 0,
    "biggestWin" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "biggestWinGame" TEXT,
    "biggestWinDate" TIMESTAMP(3),
    "biggestMultiplier" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "highestCrashPoint" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "giveawaysEntered" INTEGER NOT NULL DEFAULT 0,
    "giveawaysWon" INTEGER NOT NULL DEFAULT 0,
    "tipsReceived" INTEGER NOT NULL DEFAULT 0,
    "tipsSent" INTEGER NOT NULL DEFAULT 0,
    "totalTipValueReceived" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalTipValueSent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStatistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ipBans" (
    "id" SERIAL NOT NULL,
    "ip_address" TEXT NOT NULL,
    "banned_until" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ipBans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserVerification" (
    "id" SERIAL NOT NULL,
    "userUsername" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInventory" (
    "id" SERIAL NOT NULL,
    "userUsername" TEXT NOT NULL,
    "petId" INTEGER NOT NULL,
    "state" "UserInventoryItemState" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "petInGameId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "petVariant" "Variant"[],
    "owner_bot_id" INTEGER NOT NULL,
    "botTradeStatus" "BotTradeStatus" NOT NULL,

    CONSTRAINT "UserInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserInventoryMm2" (
    "id" SERIAL NOT NULL,
    "userUsername" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "state" "UserInventoryItemState" NOT NULL,
    "owner_bot_id" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "botTradeStatus" "BotTradeStatus" NOT NULL,

    CONSTRAINT "UserInventoryMm2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rvalue" DOUBLE PRECISION NOT NULL,
    "nvalue" DOUBLE PRECISION NOT NULL,
    "mvalue" DOUBLE PRECISION NOT NULL,
    "rvalue_nopotion" DOUBLE PRECISION NOT NULL,
    "rvalue_ride" DOUBLE PRECISION NOT NULL,
    "rvalue_fly" DOUBLE PRECISION NOT NULL,
    "rvalue_flyride" DOUBLE PRECISION NOT NULL,
    "nvalue_nopotion" DOUBLE PRECISION NOT NULL,
    "nvalue_ride" DOUBLE PRECISION NOT NULL,
    "nvalue_fly" DOUBLE PRECISION NOT NULL,
    "nvalue_flyride" DOUBLE PRECISION NOT NULL,
    "mvalue_nopotion" DOUBLE PRECISION NOT NULL,
    "mvalue_ride" DOUBLE PRECISION NOT NULL,
    "mvalue_fly" DOUBLE PRECISION NOT NULL,
    "mvalue_flyride" DOUBLE PRECISION NOT NULL,
    "category_d" TEXT NOT NULL,
    "category_n" TEXT NOT NULL,
    "category_m" TEXT NOT NULL,
    "category_preppy_d" BOOLEAN NOT NULL DEFAULT false,
    "category_preppy_n" BOOLEAN NOT NULL DEFAULT false,
    "category_preppy_m" BOOLEAN NOT NULL DEFAULT false,
    "is_flyride" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "inGameName" TEXT,

    CONSTRAINT "pets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bot" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "rblx_id" TEXT NOT NULL,
    "private_server_link" TEXT NOT NULL,
    "profile_picture" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "can_join" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mm2Bot" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "rblx_id" TEXT NOT NULL,
    "private_server_link" TEXT NOT NULL,
    "profile_picture" TEXT NOT NULL,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "can_join" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Mm2Bot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinflipGameHistory" (
    "id" SERIAL NOT NULL,
    "gameId" TEXT NOT NULL,
    "betAmount" DOUBLE PRECISION NOT NULL,
    "player1Username" TEXT NOT NULL,
    "player2Username" TEXT NOT NULL,
    "winnerSide" "Side" NOT NULL,
    "player1Side" "Side" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "player1Items" JSONB NOT NULL,
    "player2Items" JSONB NOT NULL,

    CONSTRAINT "CoinflipGameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinflipGameProvablyFairity" (
    "id" SERIAL NOT NULL,
    "gameId" TEXT NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "player1Chance" TEXT NOT NULL DEFAULT '0.50',
    "player2Chance" TEXT NOT NULL DEFAULT '0.50',

    CONSTRAINT "CoinflipGameProvablyFairity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mm2CoinflipGameHistory" (
    "id" SERIAL NOT NULL,
    "gameId" TEXT NOT NULL,
    "betAmount" DOUBLE PRECISION NOT NULL,
    "player1Username" TEXT NOT NULL,
    "player2Username" TEXT NOT NULL,
    "winnerSide" "Side" NOT NULL,
    "player1Side" "Side" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "player1Items" JSONB NOT NULL,
    "player2Items" JSONB NOT NULL,

    CONSTRAINT "Mm2CoinflipGameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mm2CoinflipGameProvablyFairity" (
    "id" SERIAL NOT NULL,
    "gameId" TEXT NOT NULL,
    "serverSeed" TEXT NOT NULL,
    "serverSeedHash" TEXT NOT NULL,
    "clientSeed" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "player1Chance" TEXT NOT NULL DEFAULT '0.50',
    "player2Chance" TEXT NOT NULL DEFAULT '0.50',

    CONSTRAINT "Mm2CoinflipGameProvablyFairity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3),
    "lastClaim" TIMESTAMP(3),
    "totalGenerated" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalClaimed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "claimableAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pendingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthlyLimit" DECIMAL(10,2),
    "lifetimeLimit" DECIMAL(10,2) DEFAULT 5000.00,
    "minimumClaim" DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.02,
    "bonusMultiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "lastReferralCodeChange" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralLog" (
    "id" TEXT NOT NULL,
    "referredUsername" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "referrerCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referralMm2Id" TEXT,

    CONSTRAINT "ReferralLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralMm2" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivity" TIMESTAMP(3),
    "lastClaim" TIMESTAMP(3),
    "totalGenerated" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalClaimed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "claimableAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "pendingAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthlyLimit" DECIMAL(10,2),
    "lifetimeLimit" DECIMAL(10,2) DEFAULT 5000.00,
    "minimumClaim" DECIMAL(10,2) NOT NULL DEFAULT 10.00,
    "commissionRate" DECIMAL(5,4) NOT NULL DEFAULT 0.02,
    "bonusMultiplier" DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "conversionCount" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "lastReferralCodeChange" TIMESTAMP(3),

    CONSTRAINT "ReferralMm2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralLogMm2" (
    "id" TEXT NOT NULL,
    "referredUsername" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "referrerCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralLogMm2_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tip_transactions" (
    "id" TEXT NOT NULL,
    "senderUsername" TEXT NOT NULL,
    "recipientUsername" TEXT NOT NULL,
    "itemIds" TEXT[],
    "totalValue" DECIMAL(10,2) NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tip_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceTipTransaction" (
    "id" TEXT NOT NULL,
    "senderUsername" TEXT NOT NULL,
    "recipientUsername" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BalanceTipTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mm2Item" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "rarity" TEXT NOT NULL,
    "inGameName" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "itemId" TEXT NOT NULL,

    CONSTRAINT "Mm2Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmpGiveaway" (
    "id" SERIAL NOT NULL,
    "minWager" INTEGER NOT NULL DEFAULT 0,
    "endDate" TIMESTAMP(3) NOT NULL,
    "petId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "Variant" "Variant"[],
    "winnerUsername" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmpGiveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AmpGiveawayEntry" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "userUsername" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmpGiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mm2Giveaway" (
    "id" SERIAL NOT NULL,
    "minWager" INTEGER NOT NULL DEFAULT 0,
    "endDate" TIMESTAMP(3) NOT NULL,
    "itemId" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "winnerUsername" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mm2Giveaway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mm2GiveawayEntry" (
    "id" SERIAL NOT NULL,
    "giveawayId" INTEGER NOT NULL,
    "userUsername" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mm2GiveawayEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KinguinPromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "isRedeemed" BOOLEAN NOT NULL DEFAULT false,
    "redeemedBy" TEXT,
    "redeemedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "KinguinCodeStatus" NOT NULL DEFAULT 'UNUSED',

    CONSTRAINT "KinguinPromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KinguinRedemptionLog" (
    "id" TEXT NOT NULL,
    "codeId" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "creditsBefore" DECIMAL(10,2) NOT NULL,
    "creditsAfter" DECIMAL(10,2) NOT NULL,
    "creditAmount" DECIMAL(10,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KinguinRedemptionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KinguinCodeBatch" (
    "id" TEXT NOT NULL,
    "batchName" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "totalCodes" INTEGER NOT NULL,
    "totalValue" DECIMAL(10,2) NOT NULL,
    "codesRedeemed" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KinguinCodeBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HashChain" (
    "id" TEXT NOT NULL,
    "finalHash" VARCHAR(64) NOT NULL,
    "clientSeed" VARCHAR(64),
    "clientSeedSetAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "chainId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "gameType" "GameType" NOT NULL,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "serverSeed" VARCHAR(128) NOT NULL,
    "totalRounds" INTEGER NOT NULL DEFAULT 1000000,

    CONSTRAINT "HashChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrashRound" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "gameHash" VARCHAR(64) NOT NULL,
    "crashPoint" DECIMAL(10,4) NOT NULL,
    "clientSeed" VARCHAR(64) NOT NULL,
    "totalBets" INTEGER NOT NULL DEFAULT 0,
    "totalWagered" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPayout" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrashRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrashBet" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "betAmount" DECIMAL(10,2) NOT NULL,
    "cashoutAt" DECIMAL(10,4),
    "autoCashout" DECIMAL(10,4),
    "didCashout" BOOLEAN NOT NULL DEFAULT false,
    "payout" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrashBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSeed" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "activeServerSeed" VARCHAR(128) NOT NULL,
    "activeServerSeedHash" VARCHAR(64) NOT NULL,
    "activeClientSeed" VARCHAR(64) NOT NULL,
    "nextServerSeed" VARCHAR(128) NOT NULL,
    "nextServerSeedHash" VARCHAR(64) NOT NULL,
    "seedCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "seedRotatedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "maxGamesPerSeed" INTEGER NOT NULL DEFAULT 10000,
    "totalGamesPlayed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedRotationHistory" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "serverSeed" VARCHAR(128) NOT NULL,
    "serverSeedHash" VARCHAR(64) NOT NULL,
    "clientSeed" VARCHAR(64) NOT NULL,
    "totalGamesPlayed" INTEGER NOT NULL,
    "seedActivatedAt" TIMESTAMP(3) NOT NULL,
    "seedRotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotationType" "SeedRotationType" NOT NULL,
    "rotationReason" TEXT,
    "userSeedId" TEXT,
    "firstNonce" INTEGER NOT NULL,
    "lastNonce" INTEGER NOT NULL,

    CONSTRAINT "SeedRotationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameHistory" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "seedRotationHistoryId" TEXT,
    "serverSeedHash" VARCHAR(64) NOT NULL,
    "clientSeed" VARCHAR(64) NOT NULL,
    "nonce" INTEGER NOT NULL,
    "gameConfig" JSONB NOT NULL,
    "gameData" JSONB NOT NULL,
    "betAmount" DECIMAL(10,2) NOT NULL,
    "finalMultiplier" DECIMAL(10,4) NOT NULL,
    "payout" DECIMAL(10,2) NOT NULL,
    "profit" DECIMAL(10,2) NOT NULL,
    "outcome" "GameOutcome" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "gameType" "GameType" NOT NULL,

    CONSTRAINT "GameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGameStatistics" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "totalGames" INTEGER NOT NULL DEFAULT 0,
    "totalWagered" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalPayout" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalProfit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "gamesWon" INTEGER NOT NULL DEFAULT 0,
    "gamesLost" INTEGER NOT NULL DEFAULT 0,
    "gamesCashedOut" INTEGER NOT NULL DEFAULT 0,
    "biggestWin" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "biggestLoss" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "highestMultiplier" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "longestWinStreak" INTEGER NOT NULL DEFAULT 0,
    "longestLossStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "firstGameAt" TIMESTAMP(3),
    "lastGameAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gameType" "GameType" NOT NULL,

    CONSTRAINT "UserGameStatistics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDepositAddress" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "coin" "AvailableCryptos" NOT NULL,
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "invoiceId" TEXT,
    "usedAmount" DECIMAL(12,2),
    "notes" TEXT,

    CONSTRAINT "UserDepositAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoTransaction" (
    "id" TEXT NOT NULL,
    "providerTransactionId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "txid" TEXT NOT NULL,
    "username" TEXT,
    "currency" "AvailableCryptos" NOT NULL,
    "network" TEXT NOT NULL,
    "usdAmountPaid" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "cryptoAmountPaid" DECIMAL(36,18) NOT NULL,
    "coinAmountPaid" DECIMAL(12,2) NOT NULL,
    "minConfirmations" INTEGER NOT NULL DEFAULT 2,
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "isFullyConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "passthrough" JSONB,
    "riskLevel" TEXT,
    "rawCallback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "CryptoTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionHistory" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "provider" "PaymentProviders" NOT NULL DEFAULT 'KINGUIN',
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "usdAmountPaid" DECIMAL(36,18) NOT NULL DEFAULT 0,
    "cryptoAmountPaid" DECIMAL(36,18) NOT NULL,
    "coinAmountPaid" DECIMAL(12,2) NOT NULL,
    "balanceAfter" DECIMAL(12,2) NOT NULL,
    "assetType" "AssetType" NOT NULL,
    "assetSymbol" TEXT,
    "referenceType" "ReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_rblx_id_key" ON "User"("rblx_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_userStatisticsId_key" ON "User"("userStatisticsId");

-- CreateIndex
CREATE INDEX "User_username_rblx_id_idx" ON "User"("username", "rblx_id");

-- CreateIndex
CREATE INDEX "User_totalXP_idx" ON "User"("totalXP" DESC);

-- CreateIndex
CREATE INDEX "User_currentLevel_idx" ON "User"("currentLevel" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userUsername_key" ON "UserSettings"("userUsername");

-- CreateIndex
CREATE INDEX "UserSettings_userUsername_idx" ON "UserSettings"("userUsername");

-- CreateIndex
CREATE UNIQUE INDEX "UserStatistics_userUsername_key" ON "UserStatistics"("userUsername");

-- CreateIndex
CREATE INDEX "UserStatistics_userUsername_idx" ON "UserStatistics"("userUsername");

-- CreateIndex
CREATE INDEX "UserStatistics_totalWagered_idx" ON "UserStatistics"("totalWagered" DESC);

-- CreateIndex
CREATE INDEX "UserStatistics_totalWageredMm2_idx" ON "UserStatistics"("totalWageredMm2" DESC);

-- CreateIndex
CREATE INDEX "UserStatistics_netProfit_idx" ON "UserStatistics"("netProfit" DESC);

-- CreateIndex
CREATE INDEX "UserStatistics_biggestWin_idx" ON "UserStatistics"("biggestWin" DESC);

-- CreateIndex
CREATE INDEX "ipBans_ip_address_idx" ON "ipBans"("ip_address");

-- CreateIndex
CREATE UNIQUE INDEX "UserVerification_key_key" ON "UserVerification"("key");

-- CreateIndex
CREATE INDEX "UserVerification_userUsername_idx" ON "UserVerification"("userUsername");

-- CreateIndex
CREATE INDEX "UserVerification_key_idx" ON "UserVerification"("key");

-- CreateIndex
CREATE INDEX "UserInventory_userUsername_idx" ON "UserInventory"("userUsername");

-- CreateIndex
CREATE INDEX "UserInventory_petId_idx" ON "UserInventory"("petId");

-- CreateIndex
CREATE INDEX "UserInventory_state_idx" ON "UserInventory"("state");

-- CreateIndex
CREATE INDEX "UserInventory_owner_bot_id_idx" ON "UserInventory"("owner_bot_id");

-- CreateIndex
CREATE INDEX "UserInventory_userUsername_id_idx" ON "UserInventory"("userUsername", "id");

-- CreateIndex
CREATE INDEX "UserInventory_id_userUsername_idx" ON "UserInventory"("id", "userUsername");

-- CreateIndex
CREATE INDEX "UserInventoryMm2_userUsername_idx" ON "UserInventoryMm2"("userUsername");

-- CreateIndex
CREATE INDEX "UserInventoryMm2_itemId_idx" ON "UserInventoryMm2"("itemId");

-- CreateIndex
CREATE INDEX "UserInventoryMm2_state_idx" ON "UserInventoryMm2"("state");

-- CreateIndex
CREATE INDEX "UserInventoryMm2_owner_bot_id_idx" ON "UserInventoryMm2"("owner_bot_id");

-- CreateIndex
CREATE INDEX "UserInventoryMm2_userUsername_state_idx" ON "UserInventoryMm2"("userUsername", "state");

-- CreateIndex
CREATE INDEX "pets_name_idx" ON "pets"("name");

-- CreateIndex
CREATE INDEX "pets_rarity_idx" ON "pets"("rarity");

-- CreateIndex
CREATE INDEX "pets_type_idx" ON "pets"("type");

-- CreateIndex
CREATE INDEX "pets_score_idx" ON "pets"("score" DESC);

-- CreateIndex
CREATE INDEX "idx_pets_name" ON "pets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Bot_rblx_id_key" ON "Bot"("rblx_id");

-- CreateIndex
CREATE INDEX "Bot_name_idx" ON "Bot"("name");

-- CreateIndex
CREATE INDEX "Bot_active_idx" ON "Bot"("active");

-- CreateIndex
CREATE INDEX "Bot_rblx_id_idx" ON "Bot"("rblx_id");

-- CreateIndex
CREATE UNIQUE INDEX "Mm2Bot_rblx_id_key" ON "Mm2Bot"("rblx_id");

-- CreateIndex
CREATE INDEX "Mm2Bot_name_idx" ON "Mm2Bot"("name");

-- CreateIndex
CREATE INDEX "Mm2Bot_active_idx" ON "Mm2Bot"("active");

-- CreateIndex
CREATE INDEX "Mm2Bot_rblx_id_idx" ON "Mm2Bot"("rblx_id");

-- CreateIndex
CREATE UNIQUE INDEX "CoinflipGameHistory_gameId_key" ON "CoinflipGameHistory"("gameId");

-- CreateIndex
CREATE INDEX "CoinflipGameHistory_player1Username_idx" ON "CoinflipGameHistory"("player1Username");

-- CreateIndex
CREATE INDEX "CoinflipGameHistory_player2Username_idx" ON "CoinflipGameHistory"("player2Username");

-- CreateIndex
CREATE UNIQUE INDEX "CoinflipGameProvablyFairity_gameId_key" ON "CoinflipGameProvablyFairity"("gameId");

-- CreateIndex
CREATE INDEX "CoinflipGameProvablyFairity_gameId_idx" ON "CoinflipGameProvablyFairity"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Mm2CoinflipGameHistory_gameId_key" ON "Mm2CoinflipGameHistory"("gameId");

-- CreateIndex
CREATE INDEX "Mm2CoinflipGameHistory_player1Username_idx" ON "Mm2CoinflipGameHistory"("player1Username");

-- CreateIndex
CREATE INDEX "Mm2CoinflipGameHistory_player2Username_idx" ON "Mm2CoinflipGameHistory"("player2Username");

-- CreateIndex
CREATE UNIQUE INDEX "Mm2CoinflipGameProvablyFairity_gameId_key" ON "Mm2CoinflipGameProvablyFairity"("gameId");

-- CreateIndex
CREATE INDEX "Mm2CoinflipGameProvablyFairity_gameId_idx" ON "Mm2CoinflipGameProvablyFairity"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_userUsername_key" ON "Referral"("userUsername");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referralCode_key" ON "Referral"("referralCode");

-- CreateIndex
CREATE INDEX "Referral_userUsername_idx" ON "Referral"("userUsername");

-- CreateIndex
CREATE INDEX "Referral_referralCode_idx" ON "Referral"("referralCode");

-- CreateIndex
CREATE INDEX "ReferralLog_referrerCode_idx" ON "ReferralLog"("referrerCode");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralMm2_userUsername_key" ON "ReferralMm2"("userUsername");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralMm2_referralCode_key" ON "ReferralMm2"("referralCode");

-- CreateIndex
CREATE INDEX "ReferralMm2_userUsername_idx" ON "ReferralMm2"("userUsername");

-- CreateIndex
CREATE INDEX "ReferralMm2_referralCode_idx" ON "ReferralMm2"("referralCode");

-- CreateIndex
CREATE INDEX "ReferralLogMm2_referrerCode_idx" ON "ReferralLogMm2"("referrerCode");

-- CreateIndex
CREATE UNIQUE INDEX "Mm2Item_itemId_key" ON "Mm2Item"("itemId");

-- CreateIndex
CREATE INDEX "Mm2Item_inGameName_idx" ON "Mm2Item"("inGameName");

-- CreateIndex
CREATE INDEX "Mm2Item_name_idx" ON "Mm2Item"("name");

-- CreateIndex
CREATE INDEX "Mm2Item_rarity_idx" ON "Mm2Item"("rarity");

-- CreateIndex
CREATE INDEX "AmpGiveaway_id_idx" ON "AmpGiveaway"("id");

-- CreateIndex
CREATE INDEX "AmpGiveaway_endDate_idx" ON "AmpGiveaway"("endDate");

-- CreateIndex
CREATE INDEX "AmpGiveaway_endDate_isActive_idx" ON "AmpGiveaway"("endDate", "isActive");

-- CreateIndex
CREATE INDEX "AmpGiveawayEntry_giveawayId_idx" ON "AmpGiveawayEntry"("giveawayId");

-- CreateIndex
CREATE INDEX "AmpGiveawayEntry_userUsername_idx" ON "AmpGiveawayEntry"("userUsername");

-- CreateIndex
CREATE INDEX "Mm2Giveaway_id_idx" ON "Mm2Giveaway"("id");

-- CreateIndex
CREATE INDEX "Mm2Giveaway_endDate_idx" ON "Mm2Giveaway"("endDate");

-- CreateIndex
CREATE INDEX "Mm2Giveaway_endDate_isActive_idx" ON "Mm2Giveaway"("endDate", "isActive");

-- CreateIndex
CREATE INDEX "Mm2GiveawayEntry_giveawayId_idx" ON "Mm2GiveawayEntry"("giveawayId");

-- CreateIndex
CREATE INDEX "Mm2GiveawayEntry_userUsername_idx" ON "Mm2GiveawayEntry"("userUsername");

-- CreateIndex
CREATE UNIQUE INDEX "KinguinPromoCode_code_key" ON "KinguinPromoCode"("code");

-- CreateIndex
CREATE INDEX "KinguinPromoCode_code_idx" ON "KinguinPromoCode"("code");

-- CreateIndex
CREATE INDEX "KinguinPromoCode_isRedeemed_idx" ON "KinguinPromoCode"("isRedeemed");

-- CreateIndex
CREATE INDEX "KinguinPromoCode_redeemedBy_idx" ON "KinguinPromoCode"("redeemedBy");

-- CreateIndex
CREATE INDEX "KinguinPromoCode_batchId_idx" ON "KinguinPromoCode"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "KinguinRedemptionLog_codeId_key" ON "KinguinRedemptionLog"("codeId");

-- CreateIndex
CREATE INDEX "KinguinRedemptionLog_userUsername_idx" ON "KinguinRedemptionLog"("userUsername");

-- CreateIndex
CREATE INDEX "KinguinRedemptionLog_redeemedAt_idx" ON "KinguinRedemptionLog"("redeemedAt");

-- CreateIndex
CREATE INDEX "KinguinCodeBatch_batchName_idx" ON "KinguinCodeBatch"("batchName");

-- CreateIndex
CREATE INDEX "KinguinCodeBatch_purchaseDate_idx" ON "KinguinCodeBatch"("purchaseDate");

-- CreateIndex
CREATE UNIQUE INDEX "HashChain_chainId_key" ON "HashChain"("chainId");

-- CreateIndex
CREATE INDEX "HashChain_gameType_isActive_idx" ON "HashChain"("gameType", "isActive");

-- CreateIndex
CREATE INDEX "HashChain_gameType_currentRound_idx" ON "HashChain"("gameType", "currentRound");

-- CreateIndex
CREATE UNIQUE INDEX "HashChain_gameType_chainId_key" ON "HashChain"("gameType", "chainId");

-- CreateIndex
CREATE UNIQUE INDEX "CrashRound_gameHash_key" ON "CrashRound"("gameHash");

-- CreateIndex
CREATE INDEX "CrashRound_chainId_roundNumber_idx" ON "CrashRound"("chainId", "roundNumber" DESC);

-- CreateIndex
CREATE INDEX "CrashRound_gameHash_idx" ON "CrashRound"("gameHash");

-- CreateIndex
CREATE UNIQUE INDEX "CrashRound_chainId_roundNumber_key" ON "CrashRound"("chainId", "roundNumber");

-- CreateIndex
CREATE INDEX "CrashBet_roundId_idx" ON "CrashBet"("roundId");

-- CreateIndex
CREATE INDEX "CrashBet_userUsername_createdAt_idx" ON "CrashBet"("userUsername", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserSeed_userUsername_key" ON "UserSeed"("userUsername");

-- CreateIndex
CREATE INDEX "UserSeed_userUsername_idx" ON "UserSeed"("userUsername");

-- CreateIndex
CREATE INDEX "SeedRotationHistory_userUsername_idx" ON "SeedRotationHistory"("userUsername");

-- CreateIndex
CREATE INDEX "SeedRotationHistory_userUsername_seedRotatedAt_idx" ON "SeedRotationHistory"("userUsername", "seedRotatedAt" DESC);

-- CreateIndex
CREATE INDEX "SeedRotationHistory_serverSeedHash_idx" ON "SeedRotationHistory"("serverSeedHash");

-- CreateIndex
CREATE UNIQUE INDEX "GameHistory_gameId_key" ON "GameHistory"("gameId");

-- CreateIndex
CREATE INDEX "GameHistory_userUsername_idx" ON "GameHistory"("userUsername");

-- CreateIndex
CREATE INDEX "GameHistory_userUsername_startedAt_idx" ON "GameHistory"("userUsername", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "GameHistory_gameType_idx" ON "GameHistory"("gameType");

-- CreateIndex
CREATE INDEX "GameHistory_outcome_idx" ON "GameHistory"("outcome");

-- CreateIndex
CREATE INDEX "GameHistory_nonce_idx" ON "GameHistory"("nonce");

-- CreateIndex
CREATE INDEX "GameHistory_serverSeedHash_idx" ON "GameHistory"("serverSeedHash");

-- CreateIndex
CREATE INDEX "GameHistory_seedRotationHistoryId_idx" ON "GameHistory"("seedRotationHistoryId");

-- CreateIndex
CREATE INDEX "UserGameStatistics_userUsername_idx" ON "UserGameStatistics"("userUsername");

-- CreateIndex
CREATE INDEX "UserGameStatistics_gameType_idx" ON "UserGameStatistics"("gameType");

-- CreateIndex
CREATE INDEX "UserGameStatistics_totalProfit_idx" ON "UserGameStatistics"("totalProfit" DESC);

-- CreateIndex
CREATE INDEX "UserGameStatistics_totalWagered_idx" ON "UserGameStatistics"("totalWagered" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "UserGameStatistics_userUsername_gameType_key" ON "UserGameStatistics"("userUsername", "gameType");

-- CreateIndex
CREATE UNIQUE INDEX "UserDepositAddress_address_key" ON "UserDepositAddress"("address");

-- CreateIndex
CREATE INDEX "UserDepositAddress_address_idx" ON "UserDepositAddress"("address");

-- CreateIndex
CREATE INDEX "UserDepositAddress_userUsername_idx" ON "UserDepositAddress"("userUsername");

-- CreateIndex
CREATE INDEX "UserDepositAddress_coin_idx" ON "UserDepositAddress"("coin");

-- CreateIndex
CREATE UNIQUE INDEX "UserDepositAddress_userUsername_coin_key" ON "UserDepositAddress"("userUsername", "coin");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoTransaction_providerTransactionId_key" ON "CryptoTransaction"("providerTransactionId");

-- CreateIndex
CREATE INDEX "TransactionHistory_userUsername_idx" ON "TransactionHistory"("userUsername");

-- CreateIndex
CREATE INDEX "TransactionHistory_category_idx" ON "TransactionHistory"("category");

-- CreateIndex
CREATE INDEX "TransactionHistory_referenceId_idx" ON "TransactionHistory"("referenceId");

-- CreateIndex
CREATE INDEX "TransactionHistory_createdAt_idx" ON "TransactionHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referedByMm2_fkey" FOREIGN KEY ("referedByMm2") REFERENCES "ReferralMm2"("referralCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referedBy_fkey" FOREIGN KEY ("referedBy") REFERENCES "Referral"("referralCode") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserStatistics" ADD CONSTRAINT "UserStatistics_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserVerification" ADD CONSTRAINT "UserVerification_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_owner_bot_id_fkey" FOREIGN KEY ("owner_bot_id") REFERENCES "Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventory" ADD CONSTRAINT "UserInventory_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventoryMm2" ADD CONSTRAINT "UserInventoryMm2_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Mm2Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventoryMm2" ADD CONSTRAINT "UserInventoryMm2_owner_bot_id_fkey" FOREIGN KEY ("owner_bot_id") REFERENCES "Mm2Bot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserInventoryMm2" ADD CONSTRAINT "UserInventoryMm2_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinflipGameHistory" ADD CONSTRAINT "CoinflipGameHistory_player1Username_fkey" FOREIGN KEY ("player1Username") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinflipGameHistory" ADD CONSTRAINT "CoinflipGameHistory_player2Username_fkey" FOREIGN KEY ("player2Username") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinflipGameProvablyFairity" ADD CONSTRAINT "CoinflipGameProvablyFairity_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "CoinflipGameHistory"("gameId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mm2CoinflipGameHistory" ADD CONSTRAINT "Mm2CoinflipGameHistory_player1Username_fkey" FOREIGN KEY ("player1Username") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mm2CoinflipGameHistory" ADD CONSTRAINT "Mm2CoinflipGameHistory_player2Username_fkey" FOREIGN KEY ("player2Username") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mm2CoinflipGameProvablyFairity" ADD CONSTRAINT "Mm2CoinflipGameProvablyFairity_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Mm2CoinflipGameHistory"("gameId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralLog" ADD CONSTRAINT "ReferralLog_referredUsername_fkey" FOREIGN KEY ("referredUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralLog" ADD CONSTRAINT "ReferralLog_referrerCode_fkey" FOREIGN KEY ("referrerCode") REFERENCES "Referral"("referralCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralMm2" ADD CONSTRAINT "ReferralMm2_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralLogMm2" ADD CONSTRAINT "ReferralLogMm2_referredUsername_fkey" FOREIGN KEY ("referredUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralLogMm2" ADD CONSTRAINT "ReferralLogMm2_referrerCode_fkey" FOREIGN KEY ("referrerCode") REFERENCES "ReferralMm2"("referralCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_transactions" ADD CONSTRAINT "tip_transactions_recipientUsername_fkey" FOREIGN KEY ("recipientUsername") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tip_transactions" ADD CONSTRAINT "tip_transactions_senderUsername_fkey" FOREIGN KEY ("senderUsername") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTipTransaction" ADD CONSTRAINT "BalanceTipTransaction_recipientUsername_fkey" FOREIGN KEY ("recipientUsername") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceTipTransaction" ADD CONSTRAINT "BalanceTipTransaction_senderUsername_fkey" FOREIGN KEY ("senderUsername") REFERENCES "User"("username") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmpGiveaway" ADD CONSTRAINT "AmpGiveaway_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmpGiveaway" ADD CONSTRAINT "AmpGiveaway_winnerUsername_fkey" FOREIGN KEY ("winnerUsername") REFERENCES "User"("username") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmpGiveawayEntry" ADD CONSTRAINT "AmpGiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "AmpGiveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AmpGiveawayEntry" ADD CONSTRAINT "AmpGiveawayEntry_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mm2Giveaway" ADD CONSTRAINT "Mm2Giveaway_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Mm2Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mm2Giveaway" ADD CONSTRAINT "Mm2Giveaway_winnerUsername_fkey" FOREIGN KEY ("winnerUsername") REFERENCES "User"("username") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mm2GiveawayEntry" ADD CONSTRAINT "Mm2GiveawayEntry_giveawayId_fkey" FOREIGN KEY ("giveawayId") REFERENCES "Mm2Giveaway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mm2GiveawayEntry" ADD CONSTRAINT "Mm2GiveawayEntry_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KinguinPromoCode" ADD CONSTRAINT "KinguinPromoCode_redeemedBy_fkey" FOREIGN KEY ("redeemedBy") REFERENCES "User"("username") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KinguinRedemptionLog" ADD CONSTRAINT "KinguinRedemptionLog_codeId_fkey" FOREIGN KEY ("codeId") REFERENCES "KinguinPromoCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KinguinRedemptionLog" ADD CONSTRAINT "KinguinRedemptionLog_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashRound" ADD CONSTRAINT "CrashRound_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "HashChain"("chainId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashBet" ADD CONSTRAINT "CrashBet_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "CrashRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrashBet" ADD CONSTRAINT "CrashBet_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSeed" ADD CONSTRAINT "UserSeed_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedRotationHistory" ADD CONSTRAINT "SeedRotationHistory_userSeedId_fkey" FOREIGN KEY ("userSeedId") REFERENCES "UserSeed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeedRotationHistory" ADD CONSTRAINT "SeedRotationHistory_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_seedRotationHistoryId_fkey" FOREIGN KEY ("seedRotationHistoryId") REFERENCES "SeedRotationHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameHistory" ADD CONSTRAINT "GameHistory_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGameStatistics" ADD CONSTRAINT "UserGameStatistics_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDepositAddress" ADD CONSTRAINT "UserDepositAddress_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionHistory" ADD CONSTRAINT "TransactionHistory_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;
