import { Module } from "@nestjs/common";
import { BalanceSyncWorker } from "./balance-sync.worker";

@Module({
    providers:[BalanceSyncWorker]
})
export class WorkersModule {}