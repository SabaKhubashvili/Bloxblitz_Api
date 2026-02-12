import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { BalanceProvider } from './providers/balance.provider';
import { BALANCE_PROVIDER } from './providers/balance.tokens';
import { hashCode } from 'src/public/modules/admin/kinguin/domain/kinguin-code.generator';
import { RedeemResult } from './contracts/redeem-result.contract';
import { TransactionHistoryService } from '../transaction-history/transaction-history.service';
import { AssetType, ReferenceType } from '@prisma/client';
import { DiscordNotificationService } from 'src/utils/discord_webhook.util';

@Injectable()
export class BalanceService {
  private readonly logger = new Logger(BalanceService.name);

  constructor(
    @Inject(BALANCE_PROVIDER)
    private readonly provider: BalanceProvider,
    private readonly transactionHistoryService: TransactionHistoryService,
    private readonly discordNotificationService: DiscordNotificationService,
  ) { }

  async redeemKinguinCode(
    username: string,
    code: string,
  ): Promise<RedeemResult> {
    this.logger.log(`Attempting to redeem Kinguin code for user ${username}`);

    try {
      const hashedCode = hashCode(code);

      // Redeem the code
      const [newBalance, codeAmount] = await this.provider.redeemKinguinCode(
        username,
        hashedCode,
      );
      await this.transactionHistoryService.addTransaction({
        username,
        direction: 'IN',
        category: 'KINGUIN_REDEEM',
        coinAmountPaid: codeAmount,
        usdAmountPaid: 0,
        cryptoAmountPaid: 0,
        assetSymbol: 'Coin',
        assetType: AssetType.GIFT_CARD,
        status: 'COMPLETED',
        balanceAfter: newBalance,
        referenceType: ReferenceType.KINGUIN_CODE,
        referenceId: hashedCode,
        provider: 'KINGUIN',
      });

      await this.discordNotificationService.sendTransactionLog({
        username,
        direction: 'IN',
        amountCoin: codeAmount,
        amountCrypto: 0,
        amountUsd: 0,
        balanceAfter: newBalance,
        status: 'COMPLETED',
        provider: 'KINGUIN',
        transactionId: 'N/A',
        additionalData: `Redeemed Kinguin code: ${code}`,
      });

      this.logger.log(
        `Kinguin code redeemed successfully. Username: ${username}, Amount: ${codeAmount}, NewBalance: ${newBalance}`,
      );

      return {
        success: true,
        message: `Successfully redeemed Kinguin code for ${codeAmount} balance.`,
        newBalance,
      };
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof BadRequestException
      )
        throw err;

      this.logger.error(
        `Unexpected error while redeeming Kinguin code for user ${username}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        'Something went wrong while redeeming the Kinguin code. Please try again later.',
      );
    }
  }
  async getBalance(username: string): Promise<{
    balance: number;
    petValueBalance: number;
  }> {
    return this.provider.getUserBalance(username);
  }
  async tipUser(
    senderUsername: string,
    recipientUsername: string,
    amount: number,
  ): Promise<{
    success: boolean;
    newSenderBalance: number;
    newRecipientBalance: number;
  }> {
    this.logger.log(
      `User ${senderUsername} is attempting to tip ${amount} to ${recipientUsername}`,
    );

    if (amount <= 0) {
      throw new BadRequestException('Tip amount must be greater than zero.');
    }

    try {
      const { newSenderBalance, newRecipientBalance } =
        await this.provider.tipUser(senderUsername, recipientUsername, amount);

      this.logger.log(
        `Tip successful. Sender: ${senderUsername}, Recipient: ${recipientUsername}, Amount: ${amount}`,
      );

      return { success: true, newSenderBalance, newRecipientBalance };
    } catch (err) {
      if (
        err instanceof UnauthorizedException ||
        err instanceof BadRequestException
      )
        throw err;

      this.logger.error(
        `Unexpected error while processing tip from ${senderUsername} to ${recipientUsername}`,
        err.stack,
      );
      throw new InternalServerErrorException(
        'Something went wrong while processing the tip. Please try again later.',
      );
    }
  }
}
