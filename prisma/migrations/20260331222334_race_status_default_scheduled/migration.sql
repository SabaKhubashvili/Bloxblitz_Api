-- Safe after 20260331222333: enum values are committed before this runs.
ALTER TABLE "Race" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
