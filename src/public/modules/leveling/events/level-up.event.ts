
export class LevelUpEvent {
  constructor(
    public readonly username: string,
    public readonly oldLevel: number,
    public readonly newLevel: number,
    public readonly totalXp: number,
    public readonly rewards: {
      balanceBonus: number;
      multiplierIncrease: number;
      milestoneReached: boolean;
      milestoneName: string | null;
    } | null,
  ) {}
}