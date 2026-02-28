import { Module } from "@nestjs/common";
import { RakebackService } from "./rakeback.service";
import { RakebackController } from "./rakeback.controller";
import { UserRepository } from "../user.repository";

@Module({
    controllers: [RakebackController],
    providers: [RakebackService, UserRepository],
    exports:[RakebackService]
})
export class RakebackModule {}