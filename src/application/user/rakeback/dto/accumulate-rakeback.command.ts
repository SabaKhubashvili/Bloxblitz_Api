export interface AccumulateRakebackCommand {
  username: string;
  wagerAmount: number;
  /** Gross amount returned to the user for this resolved bet (0 on bust). */
  returnedAmount: number;
  gameType: string;
  gameId: string;
  userLevel: number;
}
