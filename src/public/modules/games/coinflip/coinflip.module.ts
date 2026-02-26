import { Module } from "@nestjs/common";
import { CoinflipController } from "./coinflip.controller";
import { CoinflipService } from "./coinflip.service";

@Module({
        controllers:[CoinflipController],
        providers:[CoinflipService]
})
export class CoinflipModule {}