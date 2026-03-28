/*
  Warnings:

  - You are about to drop the `platform_analytics_buckets` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `platform_wager_facts` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "platform_wager_facts" DROP CONSTRAINT "platform_wager_facts_userUsername_fkey";

-- DropTable
DROP TABLE "platform_analytics_buckets";

-- DropTable
DROP TABLE "platform_wager_facts";
