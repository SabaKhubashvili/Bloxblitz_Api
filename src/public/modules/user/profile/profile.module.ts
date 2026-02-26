import { Module } from "@nestjs/common";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";
import { LevelingService } from "../../leveling/leveling.service";


@Module({
    controllers: [ProfileController],
    providers: [ProfileService, LevelingService],
    exports: [ProfileService],
})
export class ProfileModule {}