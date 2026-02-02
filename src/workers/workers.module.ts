import { Module } from "@nestjs/common";
import { BalanceSyncWorker } from "./balance-sync.worker";
import { CryptoConfirmationTrackerWorker } from "./crypto-confirmation-tracker.worker";
import { UniwireService } from "src/integrations/uniwire/uniwire.service";
import { UserRepository } from "src/public/modules/user/user.repository";
import { TransactionHistoryModule } from "src/public/modules/user/transaction-history/transaction-history.module";
import { DiscordNotificationService } from "src/utils/discord_webhook.util";
import { ConfigService } from "@nestjs/config";

@Module({
    imports:[TransactionHistoryModule],
    providers:[BalanceSyncWorker, CryptoConfirmationTrackerWorker,UniwireService,UserRepository,DiscordNotificationService,ConfigService]
})
export class WorkersModule {}