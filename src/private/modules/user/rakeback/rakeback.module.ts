import { Module } from "@nestjs/common";
import { PrivateRakebackService } from "./rakeback.service";
import { PrivateRakebackController } from "./rakeback.controller";

@Module({
    controllers: [PrivateRakebackController],
    providers: [PrivateRakebackService],
    exports:[PrivateRakebackService]
})
export class PrivateRakebackModule {}