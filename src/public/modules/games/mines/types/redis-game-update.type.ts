import { GameOutcome } from "@prisma/client";

export type RedisGameUpdate = {
  gameId: string;
  updates: {
    revealedMask?: number | string;
    active?: boolean;
    multiplier?: number;
    outcome?: GameOutcome;
    completedAt?: Date;
    payout?: number;
    profit?: number;
    serverSeed?: string;
  };
};
