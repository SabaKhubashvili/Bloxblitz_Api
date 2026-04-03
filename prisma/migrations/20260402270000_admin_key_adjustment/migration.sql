-- Adds ADMIN_ADJUSTMENT source so admin-managed key grants/deductions are
-- tracked distinctly from organic sources (wager, XP, level-up, etc.).
ALTER TYPE "UserRewardKeySource" ADD VALUE IF NOT EXISTS 'ADMIN_ADJUSTMENT';
