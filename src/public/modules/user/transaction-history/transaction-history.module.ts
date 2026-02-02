import { Module } from "@nestjs/common";
import { TransactionHistoryService } from "./transaction-history.service";
import { TransactionHistoryController } from "./transaction-history.controller";
import { PrismaService } from "src/prisma/prisma.service";
import { RedisService } from "src/provider/redis/redis.service";

@Module({
    providers:[TransactionHistoryService],
    controllers:[TransactionHistoryController],
    exports:[TransactionHistoryService],
})
export class TransactionHistoryModule {}