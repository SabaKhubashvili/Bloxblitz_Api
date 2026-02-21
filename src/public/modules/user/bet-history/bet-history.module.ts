import { Module } from "@nestjs/common";
import { BetHistoryController } from "./bet-history.controller";
import { BetHistoryService } from "./bet-history.service";
import { SeedManagementService } from "../../games/seed-managment/seed-managment.service";
import { SeedManagementModule } from "../../games/seed-managment/seed-management.module";

@Module({
    imports: [SeedManagementModule],
    controllers: [BetHistoryController],
    providers: [BetHistoryService],
    exports: [BetHistoryService],
})
export class BetHistoryModule {}