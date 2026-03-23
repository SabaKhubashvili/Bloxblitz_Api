-- CreateEnum
CREATE TYPE "CaseCatalogCategory" AS ENUM ('AMP', 'MM2');

-- AlterTable
ALTER TABLE "cases" ADD COLUMN "catalogCategory" "CaseCatalogCategory" NOT NULL DEFAULT 'AMP';

-- CreateIndex
CREATE INDEX "cases_catalogCategory_idx" ON "cases"("catalogCategory");
