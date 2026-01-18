import { OfflineGameType } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/client";

export interface BetHistoryResult {
    gameType: OfflineGameType;
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
    betAmount: Decimal;
    profit: Decimal;
    startedAt: Date;
    seedRotationHistory: {
        serverSeed: string;
    } | null;
}

export interface BetHistoryResponse {
  data: BetHistoryResult[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
