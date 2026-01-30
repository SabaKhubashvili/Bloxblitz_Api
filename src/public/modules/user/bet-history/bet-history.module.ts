import { Module } from "@nestjs/common";
import { BetHistoryController } from "./bet-history.controller";
import { BetHistoryService } from "./bet-history.service";

@Module({
    imports: [],
    controllers: [BetHistoryController],
    providers: [BetHistoryService],
    exports: [BetHistoryService],
})
export class BetHistoryModule {}