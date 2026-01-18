import { Module } from "@nestjs/common";
import { SeedManagementService } from "./seed-managment.service";
import { SeedManagementController } from "./seed-managment.controller";
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/provider/redis/redis.service";

@Module({
    controllers:[SeedManagementController],
    providers:[SeedManagementService,PrismaService,RedisService],
    exports:[SeedManagementService],
})
export class SeedManagementModule {}