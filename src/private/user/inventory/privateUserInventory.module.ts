import { Module } from "@nestjs/common";
import { PrivateUserInventoryService } from "./privateUserInventory.service";
import { PrivateUserInventoryController } from "./privateUserInventory.controller";
import { SeedManagementService } from "src/public/games/seed-managment/seed-managment.service";
import { SharedUserGamesService } from "src/shared/user/games/shared-user-games.service";


@Module({
    controllers:[PrivateUserInventoryController],
    providers:[PrivateUserInventoryService,SeedManagementService,SharedUserGamesService],
    exports:[PrivateUserInventoryService],
})
export class PrivateUserInventoryModule {}