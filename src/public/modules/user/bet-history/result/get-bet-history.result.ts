import { GameStatus, GameType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/client";

export interface SeedInfo {
  server_seed_hash: string;
  client_seed: string;
  server_seed: string | null; // only revealed after seed rotation
}

export interface MinesGameData {
  grid_size: number;
  mines_count: number;
  revealed_tiles: number[];
  mine_positions: number[];
  cashout_tile: number | null;
  mines_hit: number | null;
  seed_info: SeedInfo;
}

export interface CrashGameData {
  round_id: string;
  cashout_at: Decimal | null;
  auto_cashout: Decimal | null;
  did_cashout: boolean;
}

export interface CoinflipGameData {
  player1: string;
  player2: string;
  winner_side: "H" | "T";
  player1_side: "H" | "T";
}

export type GameData = MinesGameData | CrashGameData | CoinflipGameData | Record<string, never>;

// Type guards
export function isMinesGameData(data: GameData): data is MinesGameData {
  return "grid_size" in data;
}

export function isCrashGameData(data: GameData): data is CrashGameData {
  return "round_id" in data;
}

export function isCoinflipGameData(data: GameData): data is CoinflipGameData {
  return "player1" in data;
}

export interface BetHistoryResult {
  id: string;
  game_type: GameType;
  username: string;
  bet_amount: Decimal;
  profit: Decimal | null;
  multiplier: Decimal | null;
  status: GameStatus;
  created_at: Date;
  game_data: GameData;
}

export interface BetHistoryResponse {
  data: BetHistoryResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}