/**
 * Mines runtime configuration — shape and defaults must stay aligned with
 * BloxBlitz_Admin/admin-api/src/mines-overview/domain/mines-config.defaults.ts
 * (same Redis key and JSON fields as written by the admin API).
 */
export type MinesConfigPayload = {
  minBet: number;
  maxBet: number;
  houseEdge: number;
  rtpTarget: number;
};

export const MINES_CONFIG_REDIS_KEY = 'mines:config';

export const MINES_CONFIG_DEFAULTS: MinesConfigPayload = {
  minBet: 0.1,
  maxBet: 3000,
  houseEdge: 1,
  rtpTarget: 99,
};
