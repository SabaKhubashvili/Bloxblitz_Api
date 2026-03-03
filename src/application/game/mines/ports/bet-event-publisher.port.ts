export interface BetPlacedEvent {
  username: string;
  betAmount: number;
  gameType: string;
  gameId: string;
}

export interface IBetEventPublisherPort {
  publishBetPlaced(event: BetPlacedEvent): Promise<void>;
}
