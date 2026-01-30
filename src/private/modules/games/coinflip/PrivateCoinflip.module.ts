import { Module } from "@nestjs/common";
import { PrivateCoinflipHistoryModule } from "./history/PrivateCoinflipHistory.module";


@Module({
    imports: [PrivateCoinflipHistoryModule]
})
export class PrivateCoinflipModule {}