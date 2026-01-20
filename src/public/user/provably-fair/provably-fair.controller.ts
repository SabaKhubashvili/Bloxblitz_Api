import { Controller, Get, Request, UseGuards } from "@nestjs/common";
import { type AuthenticatedRequest, JwtAuthGuard } from "src/middleware/jwt.middleware";
import { SharedUserProvablyFairService } from "src/shared/user/provably-fair/shared-user-provably-fair.service";

@Controller('user/provably-fair')
export class ProvablyFairController {

    constructor(private readonly SharedUserProvablyFairService: SharedUserProvablyFairService) { }

    @Get('client-seed')
    @UseGuards(JwtAuthGuard)
    getClientSeed(@Request() req: AuthenticatedRequest): Promise<string | null> {
        return this.SharedUserProvablyFairService.getUserClientSeed(req.user.username);
    }
}