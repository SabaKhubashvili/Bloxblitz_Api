import { Module } from "@nestjs/common";
import { BetHistoryService } from "./private-bet-history.service";
import { PrismaService } from "src/prisma/prisma.service";
import { BetHistoryController } from "./private-bet-history.controller";

@Module({
    providers: [BetHistoryService,PrismaService],
    controllers:[BetHistoryController],
    exports: [BetHistoryService]
})
export class BetHistoryModule {}