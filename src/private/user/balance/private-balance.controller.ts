import { Body, Controller, Get } from "@nestjs/common";
import { InternalController } from "src/private/decorator/InternalController.decorator";
import { SharedBalanceService } from "src/shared/user/balance/shared-balance.service";
import { GetUserClientSeedDto } from "./dto/get-user-balance.dto";

@InternalController("user/balance")
export class PrivateBalanceController {

    constructor(private readonly sharedBalanceService: SharedBalanceService) {}

    @Get('get')
    getUserBalance(@Body() data: GetUserClientSeedDto): Promise<number> {
        return this.sharedBalanceService.getUserBalance(data.username);
    }
}