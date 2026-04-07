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
        petValue: (username: string) => `user:petValueBalance:${username}`,
  
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
  
    /* ─────────────── DICE GAME ─────────────── */

    dice: {
      ledger: (gameId: string) => `ledger:dice:${gameId}`,

      /** Admin moderation hash — `dice:control:{username}` (written by admin-api). */
      playerControl: (username: string) => `dice:control:${username}`,

      /** Global kill switch — `1` = betting disabled (written by admin-api). */
      bettingDisabled: () => 'dice:betting:disabled',
    },

    /* ─────────────── MINES GAME ─────────────── */

    mines: {
      game: (gameId: string | number) => `mines:game:${gameId}`,

      activeGame: (username: string) => `user:mines:active:${username}`,

      cells: (gameId: string | number) => `mines:cells:${gameId}`,

      bet: (gameId: string | number, username: string | number) =>
        `mines:bet:${gameId}:${username}`,

      /** Admin moderation hash — same pattern as admin-api (`mines:control:{username}`). */
      playerControl: (username: string) => `mines:control:${username}`,

      /** Rolling window (1h) of completed game ids for hourly cap enforcement. */
      rollingHourCompletions: (username: string) =>
        `mines:rollhr:mines:${username}`,

      /** Global Mines ops mode — JSON written by admin-api, read by game API. */
      systemState: () => `mines:system:state`,
    },
    /* ─────────────── JACKPOT GAME ─────────────── */
  
    jackpot: {
      status: () => `jackpot:status`,
      disabledMessage: () => `jackpot:message`,
    },
    /* ─────────────── CACHE ─────────────── */

    cache: {
      userProfile: (username: string | number) => `cache:user:profile:${username}`,
      publicUserProfile: (username: string | number) => `cache:user:publicProfile:${username}`,
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

      diceHistoryVersion: (username: string) =>
        `cache:dice:history:${username}:version`,

      diceHistoryPage: (
        username: string,
        version: number,
        page: number,
        limit: number,
        order: string,
      ) =>
        `cache:dice:history:${username}:v${version}:p${page}:l${limit}:o${order}`,

      /** Active cases catalog (list endpoint). Invalidate on case CRUD. */
      casesList: () => `cache:cases:list:active`,

      /**
       * Bumped (INCR) with `casesList` invalidation so all filtered list keys
       * rotate without SCAN. Value is a small integer; no TTL.
       */
      casesListFilterEpoch: () => `cache:cases:list:flt:epoch`,

      /** Filtered catalog snapshot: epoch + sha256(canonical filter). */
      casesListFiltered: (epoch: number, filterHashHex: string) =>
        `cache:cases:list:flt:v${epoch}:h${filterHashHex}`,

      /** Single case with items (detail endpoint). Keyed by slug. */
      caseDetail: (slug: string) =>
        `cache:cases:detail:v3:${encodeURIComponent(slug)}`,
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
  
    /* ─────────────── RATE LIMIT (sliding-ish window via fixed TTL) ─────────────── */

    rateLimit: {
      /** Fingerprint = short hash of client IP (never store raw IP in key). */
      casesList: (fingerprint: string) => `rl:cases:list:${fingerprint}`,
    },

    /* ─────────────── QUEUES ─────────────── */
    queue: {
      rakebackWagers: () => `queue:rakeback:wagers`,
    },

    /* ─────────────── DAILY SPIN ─────────────── */
    dailySpin: {
      status: (username: string) => `daily-spin:status:${username}`,
      lock:   (username: string) => `daily-spin:lock:${username}`,
    },

    /* ─────────────── LEVELING ─────────────── */
    leveling: {
      userInfo: (username: string) => `leveling:userInfo:${username}`,
      userRank: (username: string) => `leveling:userRank:${username}`,
      leaderboard: (limit: number, offset: number) => `leveling:leaderboard:${limit}:${offset}`,
      distribution: () => `leveling:distribution`,
    },

    /* ─────────────── REWARD CASES CACHE ─────────────── */
    rewardCases: {
      /**
       * Shared definitions catalog (all active cases + pool items).
       * Invalidated whenever an admin creates, updates, or deletes a case
       * definition or pool item.
       */
      definitions: () => `cache:reward-cases:definitions`,

      /** NX populate-lock to prevent cache-stampede on a cold definitions key. */
      definitionsLock: () => `cache:reward-cases:definitions:lock`,

      /**
       * Per-user balance state: key balances, totalXp, level,
       * lastCaseOpen, xpMilestoneProgress.
       * Invalidated on any mutation that touches this user's reward data.
       */
      userState: (username: string) =>
        `cache:reward-cases:user-state:${username}`,

      /**
       * Per-user exclusive lock held during a case-open flow.
       * Prevents concurrent opens / double-spend for the same user.
       * TTL is the lock lifetime in ms (set by the use-case).
       */
      openLock: (username: string) =>
        `cache:reward-cases:open-lock:${username}`,
    },

    /* ─────────────── CASE OPENING COOLDOWN ─────────────── */
    case: {
      /**
       * 24-hour cooldown for **reward level-cases** only (paid shop cases do not use this).
       * Value = Unix ms timestamp of the last reward-case open.
       * TTL = 86400 s (24 h).
       */
      cooldown: (username: string) => `case:cooldown:${username}`,
    },

    /* ─────────────── RACE (wagering leaderboard) ─────────────── */
    race: {
      current: () => `race:current`,
      /** Minimal public JSON for race strip banner / header — invalidated with `current`. */
      publicStatus: () => `race:public:status`,
      top10: (raceId: string) => `race:${raceId}:top10`,
      leaderboard: (raceId: string) => `race:${raceId}:leaderboard`,
      userRank: (raceId: string, userId: string) =>
        `race:${raceId}:rank:${userId}`,
      wagerVelocity: (username: string) => `race:wager:vel:${username}`,
      minesQuickStreak: (username: string) =>
        `race:wager:minesQuick:${username}`,
    },
  } as const;