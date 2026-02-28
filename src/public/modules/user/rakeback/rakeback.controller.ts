import { Body, Controller, Get, Post, Request, UseGuards } from "@nestjs/common";
import { RakebackService } from "./rakeback.service";
import { type AuthenticatedRequest, JwtAuthGuard } from "src/middleware/jwt.middleware";
import { ClaimRakebackDto } from "./dto/claim-rakeback.dto";

@Controller("rakeback")
export class RakebackController {
    constructor(private readonly rakebackService: RakebackService) {}

    @UseGuards(JwtAuthGuard)
    @Get("/get")
    async getRakeback(@Request() req: AuthenticatedRequest) {
        const username = req.user.username;
        return this.rakebackService.getUserRakeback(username);
    }

    @UseGuards(JwtAuthGuard)
    @Post('/claim')
    async claimRakeback(@Request() req: AuthenticatedRequest, @Body() dto: ClaimRakebackDto) {
        const username = req.user.username;
        return this.rakebackService.claimUserRakeback(username, dto.type);
    }
}