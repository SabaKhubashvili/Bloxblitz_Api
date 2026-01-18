import { Module } from "@nestjs/common";
import { BetHistoryController } from "./bet-history.controller";
import { BetHistoryService } from "./bet-history.service";
import { PrismaService } from "src/prisma/prisma.service";

@Module({
    imports: [],
    controllers: [BetHistoryController],
    providers: [BetHistoryService, PrismaService],
    exports: [BetHistoryService],
})
export class BetHistoryModule {}