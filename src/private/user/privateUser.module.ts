import { Module } from "@nestjs/common";
import { PrivateUserController } from "./privateUser.controller";
import { BetHistoryModule } from "./bet-history/private-bet-history.module";
import { PrivateProvablyFairModule } from "./provably-fair/private-provably-fair.module";

@Module({
    imports:[BetHistoryModule,PrivateProvablyFairModule],
    controllers:[PrivateUserController]
})
export class PrivateUserModule {}