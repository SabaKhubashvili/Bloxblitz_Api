/**
 * Mirrors the Prisma XpSource enum so the domain layer remains
 * Prisma-agnostic.  The infrastructure mapper converts between the two.
 */
export enum XpSource {
  GAME_WIN       = 'GAME_WIN',
  DAILY_LOGIN    = 'DAILY_LOGIN',
  REFERRAL_WAGER = 'REFERRAL_WAGER',
  STREAK_BONUS   = 'STREAK_BONUS',
  PROMO          = 'PROMO',
}
