export type TowersWagerWindow = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export function towersWagerWindowTtlSeconds(w: TowersWagerWindow): number {
  switch (w) {
    case 'DAILY':
      return 86_400;
    case 'WEEKLY':
      return 604_800;
    case 'MONTHLY':
      return 2_592_000;
  }
}
