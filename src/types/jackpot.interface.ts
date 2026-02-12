import { $Enums, Variant } from '@prisma/client';

export interface PlayerInterface {
  username: string;
  profile_picture: string;
  bet: number;
  side: 'H' | 'T';
  items: Array<CoinflipItem>;
}
export interface CoinflipItem {
  id: number;
  name: string;
  variant: Variant[];
  item_picture: string;
  value: number;
}

export interface CoinFlipGameProps {
  player1?: PlayerInterface;
  player2?: PlayerInterface;
  winner?: PlayerInterface;

  serverSeed: string;
  publicServerSeed: string;
  clientSeed: string;
  nonce: string;
  completedAt?: Date;

  maxOpponentPets?: number;
  range:number[]
}

export const rarityPriority = [
  $Enums.Variant.M,
  $Enums.Variant.N,
  $Enums.Variant.F,
  $Enums.Variant.R,
];
export interface ItemInterface {
  id: string;
  rarity: string;
  name: string;
  value: string;
  image: string;
  additional: string;
  state?: 'IDLE' | 'WITHDRAWING';
}

export interface newCoinflipGame {
  player: PlayerInterface;
}
