import { Module } from "@nestjs/common";
import { SeedManagementService } from "./seed-managment.service";
import { SeedManagementController } from "./seed-managment.controller";
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/provider/redis/redis.service";
import { SharedUserGamesService } from "src/shared/user/games/shared-user-games.service";

@Module({
    controllers:[SeedManagementController],
    providers:[SeedManagementService,PrismaService,RedisService,SharedUserGamesService],
    exports:[SeedManagementService],
})
export class SeedManagementModule {}