import type { TowersWagerWindow } from './towers-wager-window';

export type TowersPlayerRestrictionSnapshot = {
  username: string;
  banned: boolean;
  banReason: string | null;
  dailyWagerLimit: number | null;
  weeklyWagerLimit: number | null;
  monthlyWagerLimit: number | null;
  limitReason: string | null;
};

export type TowersWagerReservation = {
  appliedWindows: TowersWagerWindow[];
};
