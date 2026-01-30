import { Module } from "@nestjs/common";
import { KinguinController } from "./kinguin.controller";
import { BalanceModule } from "src/public/modules/user/balance/balance.module";

@Module({
    imports:[BalanceModule],
    controllers: [KinguinController]
})
export class KinguinModule {}