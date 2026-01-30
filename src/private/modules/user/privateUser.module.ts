import { Module } from "@nestjs/common";
import { PrivateUserController } from "./privateUser.controller";
import { BetHistoryModule } from "./bet-history/private-bet-history.module";
import { PrivateProvablyFairModule } from "./provably-fair/private-provably-fair.module";
import { PrivateUserService } from "./privateUser.service";

@Module({
    imports:[BetHistoryModule,PrivateProvablyFairModule],
    providers:[PrivateUserService],
    controllers:[PrivateUserController]
})
export class PrivateUserModule {}