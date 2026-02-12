import { CoinflipItem } from "src/types/jackpot.interface";

export interface JackpotBetItems {
  id: string;
  rarity: string;
  name: string;
  value: string;
  image: string;
  additional: string;
  state?: 'IDLE' | 'WITHDRAWING';
}

export interface JackpotPlayer {
  pets: CoinflipItem[];
  totalBet: number;
  username: string;
  profile_picture: string;
  joinedAt: Date;
}
