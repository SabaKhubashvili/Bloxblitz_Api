import { Module } from "@nestjs/common";
import { PrivateBalanceController } from "./private-balance.controller";
import { SharedBalanceService } from "src/shared/user/balance/shared-balance.service";

@Module({
    controllers:[PrivateBalanceController],
    providers:[SharedBalanceService]
})
export class PrivateBalanceModule {}