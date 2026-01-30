import { Body, Get } from "@nestjs/common";
import { SharedUserProvablyFairService } from "src/shared/user/provably-fair/shared-user-provably-fair.service";
import { getClientSeedDto } from "./dto/get-client-seed.dto";
import { InternalController } from "../../games/decorator/InternalController.decorator";

@InternalController('user/provably-fair')
export class ProvablyFairController {

    constructor(private readonly SharedUserProvablyFairService: SharedUserProvablyFairService) { }

    @Get('client-seed')
    getClientSeed(@Body() body: getClientSeedDto): Promise<string | null> {
        return this.SharedUserProvablyFairService.getUserClientSeed(body.username);
    }
}