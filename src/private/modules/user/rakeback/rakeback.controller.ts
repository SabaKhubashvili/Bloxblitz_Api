import { Controller, Post, Request, UseGuards } from "@nestjs/common";
import { PrivateRakebackService } from "./rakeback.service";
import { InternalController } from "../../games/decorator/InternalController.decorator";
import { ProcessRakebackDto } from "./dto/process-rakeback.dto";

@InternalController('/rakeback')
export class PrivateRakebackController {
    constructor(private readonly rakebackService: PrivateRakebackService) {}

    @Post('/process') async processRakeback(@Request() req: { body: ProcessRakebackDto }) {
        const { username, wagerAmount } = req.body;
        await this.rakebackService.processRakebackForUser(username, wagerAmount);
        return { message: 'Rakeback processed successfully' };
    }
}