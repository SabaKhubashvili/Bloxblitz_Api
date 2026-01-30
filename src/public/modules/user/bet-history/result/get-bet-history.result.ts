import { GameOutcome, GameType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/client";

export interface BetHistoryResult {
    id:string,
    gameType: GameType;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    betAmount: Decimal;
    profit: Decimal;
    startedAt: Date;
    userUsername:string,
    seedRotationHistory: {
        serverSeed: string;
    } | null;
    finalMultiplier: Decimal;
    payout: Decimal;
    outcome: GameOutcome
    
}

export interface BetHistoryResponse {
  data: BetHistoryResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
