export interface RollDiceCommand {
  username: string;
  profilePicture?: string;
  betAmount: number;
  chance: number;
  rollMode: 'OVER' | 'UNDER';
}
