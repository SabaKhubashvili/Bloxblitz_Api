-- AlterEnum: new values must not be referenced (e.g. SET DEFAULT) in the same
-- transaction as ADD VALUE — see second migration for status default.

ALTER TYPE "RaceStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "RaceStatus" ADD VALUE 'PAUSED';
ALTER TYPE "RaceStatus" ADD VALUE 'CANCELLED';

-- AlterTable (only columns that do not use newly added enum labels)
ALTER TABLE "Race" ADD COLUMN "raceWindow" TEXT,
ADD COLUMN "trackingPaused" BOOLEAN NOT NULL DEFAULT false;
