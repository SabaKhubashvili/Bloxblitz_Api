import { Module } from "@nestjs/common";
import { PrivateUserController } from "./privateUser.controller";
import { BetHistoryModule } from "./bet-history/private-bet-history.module";
import { PrivateProvablyFairModule } from "./provably-fair/private-provably-fair.module";
import { PrivateUserService } from "./privateUser.service";
import { LevelingService } from "src/public/modules/leveling/leveling.service";
import { PrivateRakebackModule } from "./rakeback/rakeback.module";

@Module({
    imports:[BetHistoryModule,PrivateProvablyFairModule,PrivateRakebackModule],
    providers:[PrivateUserService,LevelingService],
    controllers:[PrivateUserController]
})
export class PrivateUserModule {}