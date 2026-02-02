import { Module } from "@nestjs/common";
import { UniwireService } from "./uniwire.service";
import { UniwireController } from "./uniwire.controller";
import { UserRepository } from "src/public/modules/user/user.repository";
import { TransactionHistoryService } from "src/public/modules/user/transaction-history/transaction-history.service";
import { PrismaService } from "src/prisma/prisma.service";
import { DiscordNotificationService } from "src/utils/discord_webhook.util";
import { ConfigService } from "@nestjs/config";

@Module({
    controllers: [UniwireController],
    providers:[UniwireService,UserRepository,TransactionHistoryService,DiscordNotificationService,ConfigService],
    exports:[UniwireService],
})
export class UniwireModule {}