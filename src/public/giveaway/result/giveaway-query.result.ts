import { Variant } from "@prisma/client";

export type GiveawayResult = {
  id: number;
  Variant: Variant[];
  endDate: Date;
  minWager: number;
  petName: string | null;
  petImage: string | null;
  winnerUsername: string | null;
  userJoined: number; 
  totalEntries: number;
};