-- CreateEnum
CREATE TYPE "AnalyticsBucketGranularity" AS ENUM ('HOUR', 'DAY');

-- CreateTable
CREATE TABLE "platform_wager_facts" (
    "id" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userUsername" TEXT,
    "payout_amount" DECIMAL(14,2),

    CONSTRAINT "platform_wager_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_analytics_buckets" (
    "id" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "granularity" "AnalyticsBucketGranularity" NOT NULL,
    "total_stake" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "bet_count" INTEGER NOT NULL DEFAULT 0,
    "active_user_count" INTEGER NOT NULL DEFAULT 0,
    "total_payout" DECIMAL(16,2) NOT NULL DEFAULT 0,

    CONSTRAINT "platform_analytics_buckets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_wager_facts_gameType_created_at_idx" ON "platform_wager_facts"("gameType", "created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_wager_facts_created_at_idx" ON "platform_wager_facts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_wager_facts_userUsername_created_at_idx" ON "platform_wager_facts"("userUsername", "created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_analytics_buckets_granularity_period_start_idx" ON "platform_analytics_buckets"("granularity", "period_start" DESC);

-- CreateIndex
CREATE INDEX "platform_analytics_buckets_gameType_granularity_period_start_idx" ON "platform_analytics_buckets"("gameType", "granularity", "period_start" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "platform_analytics_buckets_gameType_period_start_granularity_key" ON "platform_analytics_buckets"("gameType", "period_start", "granularity");

-- AddForeignKey
ALTER TABLE "platform_wager_facts" ADD CONSTRAINT "platform_wager_facts_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE SET NULL ON UPDATE CASCADE;
