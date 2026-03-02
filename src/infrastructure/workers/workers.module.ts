import { Module } from '@nestjs/common';
import { BalanceSyncWorker } from './balance-sync.worker.js';

@Module({
  providers: [BalanceSyncWorker],
})
export class WorkersModule {}
