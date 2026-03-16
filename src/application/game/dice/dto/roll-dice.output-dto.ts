export interface RollDiceOutputDto {
  id: string;
  rollResult: number;
  betAmount: number;
  chance: number;
  rollMode: 'OVER' | 'UNDER';
  multiplier: number;
  payout: number;
  profit: number;
  won: boolean;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}
