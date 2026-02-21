import { GameStatus } from "@prisma/client";

export type RedisGameUpdate = {
  gameId: string;
  updates: {
    revealedMask?: number | string;
    active?: boolean;
    multiplier?: number;
    status?: GameStatus;
    completedAt?: Date;
    payout?: number;
    profit?: number;
    serverSeed?: string;
  };
};
