import { Get, Query } from "@nestjs/common";
import { SharedBalanceService } from "src/shared/user/balance/shared-balance.service";
import { GetUserClientSeedDto } from "./dto/get-user-balance.dto";
import { InternalController } from "../../games/decorator/InternalController.decorator";

@InternalController("user/balance")
export class PrivateBalanceController {

    constructor(private readonly sharedBalanceService: SharedBalanceService) {}

    @Get('get')
    getUserBalance(@Query() data: GetUserClientSeedDto): Promise<number> {
        return this.sharedBalanceService.getUserBalance(data.username);
    }
}