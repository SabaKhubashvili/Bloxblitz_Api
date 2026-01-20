/**
 * Redis key registry
 *
 * Rules:
 * - All keys are lowercase
 * - Colon-separated namespaces
 * - Dynamic parts always at the end
 * - Never hardcode Redis keys outside this file
 */

export const RedisKeys = {
  /* ─────────────── USER ─────────────── */
  user: {
    clientSeed: (username: string) => `user:clientSeed:${username}`,
    nonce: (username: string) => `user:nonce:${username}`,
    lockSeed: (username: string) => `user:lockSeed:${username}`,
    userSeed: (username: string) => `user:seed:${username}`,
    seedRotationHistory: (username: string, rotationId: string) =>
      `user:seedRotationHistory:${username}:${rotationId}`,
    seedRotationHistoryList: (username: string) =>
      `user:seedRotationHistory:${username}:list`,
    seedRotationRetry: (username: string, rotationId: string) =>
      `user:seedRotationRetry:${username}:${rotationId}`,

    /* ─────────────── BALANCES ─────────────── */

    balance: {
      user: (username: string) => `user:balance:${username}`,

      dirty: (username: string) => `user:balance:dirty:${username}`,
      syncQueue: () => `user:balance:sync:queue`,
    },

    // ────────────── GAMES ─────────────── //
    games: {
      active: (username: string) => `user:games:active:${username}`,
    },
  },

  /* ─────────────── LOCKS ─────────────── */

  lock: {
    crash: () => `lock:crash`,

    mines: (gameId: string | number) => `lock:mines:${gameId}`,

    user: (userId: string | number) => `lock:user:${userId}`,
  },
  /* ─────────────── COINFLIP GAME ─────────────── */
  coinflip: {
    housePercentage: () => `coinflip:housePercentage`,
    getStatus: () => `coinflip:status`,
    getDisabledMessage: () => `coinflip:disabledMessage`,
    bannedUsers: () => `coinflip:bannedUsers`,
  },
  /* ─────────────── CRASH GAME ─────────────── */

  crash: {
    state: () => `crash:state`,

    round: (roundId: string | number) => `crash:round:${roundId}`,

    players: (roundId: string | number) => `crash:players:${roundId}`,

    history: () => `crash:history`,
    provablyFair: () => `crash:provablyFair`,
  },

  /* ─────────────── MINES GAME ─────────────── */

  mines: {
    game: (gameId: string | number) => `mines:game:${gameId}`,

    cells: (gameId: string | number) => `mines:cells:${gameId}`,

    bet: (gameId: string | number, userId: string | number) =>
      `mines:bet:${gameId}:${userId}`,
  },
  /* ─────────────── JACKPOT GAME ─────────────── */

  jackpot: {
    status: () => `jackpot:status`,
    disabledMessage: () => `jackpot:message`,
  },
  /* ─────────────── CACHE ─────────────── */

  cache: {
    userProfile: (userId: string | number) => `cache:user:profile:${userId}`,

    inventory: (userId: string | number) => `cache:user:inventory:${userId}`,

    prices: () => `cache:prices`,
  },
  chat: {
    bans: () => `chat:bans`,
    timeouts: () => `chat:timeouts`,
  },

  /* ─────────────── RAIN ─────────────── */
  rain: {
    getState: () => `rain:state`,
    setState: () => `rain:state`,
  },
} as const;
