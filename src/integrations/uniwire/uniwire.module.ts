import { Module } from "@nestjs/common";
import { UniwireService } from "./uniwire.service";
import { UniwireController } from "./uniwire.controller";
import { UserRepository } from "src/public/modules/user/user.repository";

@Module({
    controllers: [UniwireController],
    providers:[UniwireService,UserRepository],
    exports:[UniwireService],
})
export class UniwireModule {}