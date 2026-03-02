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
      online: (username: string ) => `user:online:${username}`,
      profile: (username: string) => `user:profile:${username}`,
      publicProfile: (username: string) => `user:publicProfile:${username}`,
  
      /* ─────────────── BALANCES ─────────────── */
  
      balance: {
        user: (username: string) => `user:balance:${username}`,
        value: (username: string) => `user:valueBalance:${username}`,
  
        dirty: (username: string) => `user:balance:dirty`,
        syncQueue: () => `user:balance:sync:queue`,
      },
  
      // ────────────── GAMES ─────────────── //
      games: {
        active: (username: string) => `user:games:active:${username}:list`,
      },
      rakeback:{
        user: (username: string) => `user:rakeback:${username}`,
      }
      
    },
  
    /* ─────────────── LOCKS ─────────────── */
  
    lock: {
      crash: () => `lock:crash`,
  
      mines: (gameId: string | number) => `lock:mines:${gameId}`,
  
      user: (username: string | number) => `lock:user:${username}`,
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

      activeGame: (username: string) => `user:mines:active:${username}`,

      cells: (gameId: string | number) => `mines:cells:${gameId}`,

      bet: (gameId: string | number, username: string | number) =>
        `mines:bet:${gameId}:${username}`,
    },
    /* ─────────────── JACKPOT GAME ─────────────── */
  
    jackpot: {
      status: () => `jackpot:status`,
      disabledMessage: () => `jackpot:message`,
    },
    /* ─────────────── CACHE ─────────────── */

    cache: {
      userProfile: (username: string | number) => `cache:user:profile:${username}`,

      inventory: (username: string | number) => `cache:user:inventory:${username}`,

      prices: () => `cache:prices`,

      /**
       * Monotonic counter — INCR to invalidate all page cache entries for a
       * user without an expensive SCAN/KEYS call.  No TTL; the value is tiny.
       */
      minesHistoryVersion: (username: string) =>
        `cache:mines:history:${username}:version`,

      /** Page key embeds the version so old pages become unreachable instantly. */
      minesHistoryPage: (
        username: string,
        version: number,
        page: number,
        limit: number,
        order: string,
      ) => `cache:mines:history:${username}:v${version}:p${page}:l${limit}:o${order}`,

      minesRound: (gameId: string) => `cache:mines:round:${gameId}`,
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
  
    /* ─────────────── GIVEAWAY ─────────────── */
    giveaway: {
      getState: () => `giveaway:state`,
      setState: () => `giveaway:state`,
      userJoined: (username: string) =>
        `user:${username}:joined_giveaways`,
    },
    /* ─────────────── CRYPTO CONFIRMATIONS ─────────────── */
    crypto: {
      confirmations: {
        active: `tx:confirmations:active`,
      },
    },
  
    /* ─────────────── LEVELING ─────────────── */
    leveling: {
      userInfo: (username: string) => `leveling:userInfo:${username}`,
      userRank: (username: string) => `leveling:userRank:${username}`,
      leaderboard: (limit: number, offset: number) => `leveling:leaderboard:${limit}:${offset}`,
      distribution: () => `leveling:distribution`,
    },
  } as const;