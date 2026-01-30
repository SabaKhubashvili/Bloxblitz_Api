import { Module } from "@nestjs/common";
import { PrivateUserInventoryService } from "./privateUserInventory.service";
import { PrivateUserInventoryController } from "./privateUserInventory.controller";
import { SeedManagementService } from "src/public/modules/games/seed-managment/seed-managment.service";
import { SharedUserGamesService } from "src/shared/user/games/shared-user-games.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { PrismaService } from "src/prisma/prisma.service";


@Module({
  imports: [PrismaModule], // <- Import the module that exports PrismaService
  controllers: [PrivateUserInventoryController],
  providers: [
    PrivateUserInventoryService,
    SeedManagementService,
    SharedUserGamesService,
  ],
  exports: [PrivateUserInventoryService],
})
export class PrivateUserInventoryModule {
    
}
