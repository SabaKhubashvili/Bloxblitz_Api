import { Module } from "@nestjs/common";
import { PrivateCoinflipHistoryService } from "./PrivateCoinflipHistory.service";
import { PrivateCoinflipHistoryController } from "./PrivateCoinflipHistory.controller";

@Module({
    controllers: [PrivateCoinflipHistoryController],
    providers: [PrivateCoinflipHistoryService],
    exports: [PrivateCoinflipHistoryService],

})
export class PrivateCoinflipHistoryModule {}