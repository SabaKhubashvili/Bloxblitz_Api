export interface BetPlacedEvent {
  readonly username: string,
  readonly game: string,
  readonly profilePicture: string,
  readonly amount: number,
  readonly level: number,
  readonly multiplier: number,
  readonly profit: number,
  readonly createdAt?: number,
  type?: string;
}

export interface IBetEventPublisherPort {
  publishBetPlaced(event: BetPlacedEvent): Promise<void>;
}
