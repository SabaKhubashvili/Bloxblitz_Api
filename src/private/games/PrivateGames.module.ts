import { Module } from "@nestjs/common";
import { PrivateCoinflipModule } from "./coinflip/PrivateCoinflip.module";
import { PrivateCrashModule } from "./crash/PrivateCrash.module";

@Module({
    imports: [PrivateCoinflipModule, PrivateCrashModule],
})
export class PrivateGamesModule {   
}