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
  readonly createdAt?: number;
  type?: string;
}

export interface IBetEventPublisherPort {
  publishBetPlaced(event: BetPlacedEvent): Promise<void>;
}
