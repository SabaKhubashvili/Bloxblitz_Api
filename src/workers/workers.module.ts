import { Module } from "@nestjs/common";
import { BalanceSyncWorker } from "./balance-sync.worker";
import { CryptoConfirmationTrackerWorker } from "./crypto-confirmation-tracker.worker";
import { UniwireService } from "src/integrations/uniwire/uniwire.service";
import { UserRepository } from "src/public/modules/user/user.repository";

@Module({
    providers:[BalanceSyncWorker, CryptoConfirmationTrackerWorker,UniwireService,UserRepository]
})
export class WorkersModule {}