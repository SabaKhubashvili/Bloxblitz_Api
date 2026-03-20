-- CreateEnum
CREATE TYPE "CaseVariant" AS ENUM ('FEATURED', 'STANDARD', 'HIGH_RISK');

-- AlterEnum
ALTER TYPE "GameType" ADD VALUE 'CASE';

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "variant" "CaseVariant" NOT NULL DEFAULT 'STANDARD',
    "riskLevel" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_items" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "petId" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "case_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_open_history" (
    "id" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "wonCaseItemId" TEXT NOT NULL,
    "openBatchIndex" INTEGER NOT NULL DEFAULT 0,
    "pricePaid" DECIMAL(12,2) NOT NULL,
    "clientSeed" VARCHAR(64) NOT NULL,
    "serverSeedHash" VARCHAR(64) NOT NULL,
    "nonce" INTEGER NOT NULL,
    "normalizedRoll" DECIMAL(24,8) NOT NULL,
    "serverSeed" VARCHAR(128),
    "seedRotationHistoryId" TEXT,
    "gameHistoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_open_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cases_slug_key" ON "cases"("slug");

-- CreateIndex
CREATE INDEX "cases_isActive_sortOrder_idx" ON "cases"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "cases_slug_idx" ON "cases"("slug");

-- CreateIndex
CREATE INDEX "cases_variant_idx" ON "cases"("variant");

-- CreateIndex
CREATE INDEX "case_items_caseId_idx" ON "case_items"("caseId");

-- CreateIndex
CREATE INDEX "case_items_petId_idx" ON "case_items"("petId");

-- CreateIndex
CREATE UNIQUE INDEX "case_open_history_gameHistoryId_key" ON "case_open_history"("gameHistoryId");

-- CreateIndex
CREATE INDEX "case_open_history_userUsername_idx" ON "case_open_history"("userUsername");

-- CreateIndex
CREATE INDEX "case_open_history_caseId_idx" ON "case_open_history"("caseId");

-- CreateIndex
CREATE INDEX "case_open_history_createdAt_idx" ON "case_open_history"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "case_open_history_userUsername_createdAt_idx" ON "case_open_history"("userUsername", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "case_open_history_serverSeedHash_idx" ON "case_open_history"("serverSeedHash");

-- AddForeignKey
ALTER TABLE "case_items" ADD CONSTRAINT "case_items_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_items" ADD CONSTRAINT "case_items_petId_fkey" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_open_history" ADD CONSTRAINT "case_open_history_seedRotationHistoryId_fkey" FOREIGN KEY ("seedRotationHistoryId") REFERENCES "SeedRotationHistory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_open_history" ADD CONSTRAINT "case_open_history_gameHistoryId_fkey" FOREIGN KEY ("gameHistoryId") REFERENCES "GameHistory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_open_history" ADD CONSTRAINT "case_open_history_userUsername_fkey" FOREIGN KEY ("userUsername") REFERENCES "User"("username") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_open_history" ADD CONSTRAINT "case_open_history_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_open_history" ADD CONSTRAINT "case_open_history_wonCaseItemId_fkey" FOREIGN KEY ("wonCaseItemId") REFERENCES "case_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
