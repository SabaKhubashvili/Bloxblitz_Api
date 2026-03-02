export interface BetPlacedEvent {
  username: string;
  betAmount: number;
  gameType: 'MINES';
  gameId: string;
}

export interface IBetEventPublisherPort {
  publishBetPlaced(event: BetPlacedEvent): Promise<void>;
}
