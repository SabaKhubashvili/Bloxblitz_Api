import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RedisService } from 'src/provider/redis/redis.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UniwireService } from 'src/integrations/uniwire/uniwire.service';
import { RedisKeys } from 'src/provider/redis/redis.keys';

@Injectable()
export class CryptoConfirmationTrackerWorker {
  private readonly logger = new Logger(CryptoConfirmationTrackerWorker.name);
  private isRunning = false;

  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly uniwireService: UniwireService,
  ) {}

  /**
   * Poll confirmations every 30 seconds (BTC-safe)
   * Faster chains should use a separate worker
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async trackConfirmations() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const transactionIds = await this.redis.smembers(
        RedisKeys.crypto.confirmations.active,
      );

      if (transactionIds.length === 0) return;

      this.logger.debug(`Tracking ${transactionIds.length} transactions`);

      await this.processTransactions(transactionIds);
    } catch (err) {
      this.logger.error('Confirmation tracking failed', err);
    } finally {
      this.isRunning = false;
    }
  }

  private async processTransactions(transactionIds: string[]) {
    const transactions = await this.prisma.cryptoTransaction.findMany({
      where: { providerTransactionId: { in: transactionIds } },
    });

    if (!transactions || transactions.length === 0) {
      // Remove all invalid transaction IDs from Redis
      for (const txid of transactionIds) {
        await this.redis.srem(RedisKeys.crypto.confirmations.active, txid);
      }
      return;
    }

    // Process each transaction
    for (const tx of transactions) {
      try {
        await this.processTransaction(tx);
      } catch (err) {
        this.logger.error(
          `Failed to process transaction ${tx.providerTransactionId}`,
          err,
        );
      }
    }

    // Clean up transaction IDs that weren't found in database
    const foundTxIds = transactions.map((t) => t.providerTransactionId);
    const notFoundTxIds = transactionIds.filter(
      (id) => !foundTxIds.includes(id),
    );

    for (const txid of notFoundTxIds) {
      await this.redis.srem(RedisKeys.crypto.confirmations.active, txid);
      this.logger.warn(
        `Removed non-existent transaction from tracking: ${txid}`,
      );
    }
  }

  private async processTransaction(tx: any) {
    const txid = tx.providerTransactionId;
    console.log(`processing ${txid} transaction`);
    
    // Skip non-pending transactions and remove from tracking
    if (tx.status !== 'PENDING') {
      await this.redis.srem(RedisKeys.crypto.confirmations.active, txid);
      this.logger.debug(
        `Removed ${tx.status} transaction from tracking: ${txid}`,
      );
      return;
    }

    // Fetch latest confirmation data from Uniwire
    const uniwireTx = await this.fetchUniwireTransaction(txid);

    if (!uniwireTx) {
      this.logger.warn(`Could not fetch Uniwire data for transaction: ${txid}`);
      return;
    }

    const newConfirmations = uniwireTx.confirmations;

    // 🔒 Idempotency guard - only update if confirmations increased
    if (newConfirmations <= tx.confirmations) {
      this.logger.debug(
        `No confirmation change for ${txid}: ${tx.confirmations} -> ${newConfirmations}`,
      );
      return;
    }

    // Update confirmations in database
    await this.prisma.cryptoTransaction.update({
      where: { id: tx.id },
      data: {
        confirmations: newConfirmations,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `🔗 TX ${txid} confirmations: ${tx.confirmations} → ${newConfirmations}`,
    );
  }

  /**
   * Fetch transaction confirmation data from Uniwire API
   */
  private async fetchUniwireTransaction(
    transactionId: string,
  ): Promise<{ confirmations: number } | null> {
    try {
      const response = await this.uniwireService.request(
        '/v1/transactions/confirmations/',
        {
          id: [transactionId],
        },
        'POST',
      );

      // Validate response structure
      if (!response || !response.result || typeof response.result[0].confirmations !== 'number') {
        this.logger.warn(
          `Invalid Uniwire response for transaction ${transactionId}`,
        );
        return null;
      }

      return {
        confirmations: response.result[0].confirmations,
      };
    } catch (err) {
      this.logger.error(
        `Failed to fetch Uniwire transaction ${transactionId}`,
        err,
      );
      return null;
    }
  }
}
