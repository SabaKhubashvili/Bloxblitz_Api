export interface BetPlacedEvent {
  readonly username: string,
  readonly game: string,
  readonly profilePicture: string,
  readonly amount: number,
  readonly level: number,
  readonly multiplier: number,
  readonly profit: number,
  /** Idempotent rakeback processing (`RakebackAccumulationWorker`). */
  readonly gameId?: string;
  /** Cash / credit returned to the player for this round (0 if bust). */
  readonly returnedAmount?: number;
  /** Same currency as `returnedAmount` when both are set (e.g. case pet value paid out). */
  readonly payout?: number;
  readonly createdAt?: number;
  /** When distinct from `username` (often the same value in this codebase). */
  readonly userId?: string;
  readonly caseId?: string;
  readonly result?: 'win' | 'loss';
  type?: string;
}

export interface IBetEventPublisherPort {
  publishBetPlaced(event: BetPlacedEvent): Promise<void>;
}
