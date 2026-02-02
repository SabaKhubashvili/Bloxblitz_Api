import { Injectable, Logger } from '@nestjs/common';
import { Webhook, MessageBuilder } from 'discord-webhook-node';
import { ConfigService } from '@nestjs/config';
import { Variant } from '@prisma/client';
import {
  CoinflipItem,
  PlayerInterface,
} from 'src/coinflip/types/jackpot.interface';
import { JackpotPlayer } from 'src/common/types/jackpot/jackpot.interface';

@Injectable()
export class DiscordNotificationService {
  private readonly flips_webhook: Webhook;
  private readonly jackpot_webhook: Webhook;
  private readonly botLoggerWebhook: Webhook;
  private readonly chatLoggerWebhook: Webhook;
  private readonly depositsWebhook: Webhook;
  private readonly withdrawalsWebhook: Webhook;
  private readonly logger = new Logger(DiscordNotificationService.name);

  constructor(private configService: ConfigService) {
    this.flips_webhook = new Webhook({
      url: this.configService.get<string>('DISCORD_FLIPS_WEBHOOK') || '',
      retryOnLimit: false,
    });
    this.jackpot_webhook = new Webhook({
      url: this.configService.get<string>('DISCORD_JACKPOT_WEBHOOOK') || '',
      retryOnLimit: false,
    });
    this.botLoggerWebhook = new Webhook({
      url: this.configService.get<string>('DISCORD_BOT_LOGS_WEBHOOOK') || '',
      retryOnLimit: false,
    });
    this.chatLoggerWebhook = new Webhook({
      url: this.configService.get<string>('DISCORD_CHAT_LOGS_WEBHOOK') || '',
      retryOnLimit: false,
    });
    this.depositsWebhook = new Webhook({
      url: this.configService.get<string>('DISCORD_DEPOSITS_WEBHOOK') || '',
      retryOnLimit: true,
    });
    this.withdrawalsWebhook = new Webhook({
      url: this.configService.get<string>('DISCORD_WITHDRAWALS_WEBHOOK') || '',
      retryOnLimit: true,
    });
    
  }

  /**
   * Sends a Discord notification when a new coinflip game is created
   * @param creator The player who created the game
   * @param items The items being wagered
   * @param totalValue The total value of items
   */
  async sendGameCreationDiscordNotification(
    creator: PlayerInterface,
    items: CoinflipItem[],
    totalValue: number,
  ): Promise<void> {
    try {
      const color = totalValue > 150 ? 0xffd700 : 0x808080;
      const message = new MessageBuilder()
        .setTitle(
          `🪙 New ${totalValue > 150 ? 'High Value' : ''} Coinflip | ${creator.username}`,
        )
        .setColor(color)
        .setDescription(
          `
          Value: ${totalValue}\n
          Pets: ${this.formatItemsForDiscord(items)}
        `,
        )
        .setTimestamp()
        .setFooter('Coin Flip Bot');
      await this.flips_webhook.send(message);
    } catch (error) {
      this.logger.warn(`Failed to send Discord notification: ${error.message}`);
    }
  }

  /**
   * Formats items for Discord message
   * @param items The items to format
   * @returns Formatted string of items
   */
  private formatItemsForDiscord(items: CoinflipItem[]): string {
    return items
      .sort((a, b) => b.value - a.value)
      .map((item) => {
        let name = '';
        if (item.variant.includes(Variant.M)) {
          name = `**${item.name}** 🌟`;
        } else if (item.variant.includes(Variant.N)) {
          name = `**${item.name}** ✨`;
        } else if (
          item.variant.includes(Variant.F) ||
          item.variant.includes(Variant.R)
        ) {
          name = `*${item.name}*`;
        } else {
          name = item.name;
        }
        if (item.variant.length > 0) {
          name += `[${item.variant.join(',')}]`;
        }
        return name;
      })
      .join(', ');
  }

  /**
   * Sends a Discord notification when a coinflip game has finished
   * @param winner The winning player
   * @param loser The losing player
   * @param totalPoolValue The total value of the pool
   * @param allItems All items in the pool
   */
  async sendGameResultDiscordNotification(
    winner: PlayerInterface,
    loser: PlayerInterface,
    totalPoolValue: number,
    allItems: CoinflipItem[],
  ): Promise<void> {
    try {
      const color = totalPoolValue > 150 ? 0xffd700 : 0x808080;
      const message = new MessageBuilder()
        .setTitle(
          `🪙 ${totalPoolValue > 150 ? 'High Value' : ''} Coinflip Finished | Winner: ${winner.username}`,
        )
        .setColor(color)
        .setDescription(
          `
          Winner: ${winner.username}
          Loser: ${loser.username}
          
          Value: ${totalPoolValue}\n
          Pets: ${this.formatItemsForDiscord(allItems)}
        `,
        )
        .setTimestamp()
        .setFooter('Coin Flip Bot');
      await this.flips_webhook.send(message);
    } catch (error) {
      this.logger.warn(`Failed to send Discord notification: ${error.message}`);
    }
  }
  async sendJackpotFinishedResult(
    winner: JackpotPlayer,
    allPlayers: JackpotPlayer[],
    totalPoolValue: number,
    allItems: CoinflipItem[],
  ): Promise<void> {
    try {
      const color = totalPoolValue > 150 ? 0xffd700 : 0x808080;

      const playerStats = allPlayers
        .map((player) => {
          const percentage = ((player.totalBet / totalPoolValue) * 100).toFixed(
            2,
          );
          return `• ${player.username}: ${percentage}%`;
        })
        .join('\n');

      const message = new MessageBuilder()
        .setTitle(
          `🪙 ${totalPoolValue > 150 ? 'High Value' : ''} Jackpot Finished | Winner: ${winner.username}`,
        )
        .setColor(color)
        .setDescription(
          `
        **Winner:** ${winner.username}
        **Total Value:** ${totalPoolValue}
        **Pets:** ${this.formatItemsForDiscord(allItems)}

        **Chances:**
        ${playerStats}
      `,
        )
        .setTimestamp()
        .setFooter('Coin Flip Bot');

      await this.jackpot_webhook.send(message);
    } catch (error) {
      this.logger.warn(`Failed to send Discord notification: ${error.message}`);
    }
  }
  async sendUserDepositToWebhook(
    botUsername: number,
    senderUsername: string,
    items: { petVariant: Variant[]; name: string; value: number }[],
  ): Promise<void> {
    try {
      const totalItems = items.length;

      const formattedItems = items
        .map((item) => {
          return `**${item.name}** (${item.value} value) ${item.petVariant}`;
        })
        .join('\n');

      const color = totalItems > 3 ? 0x00ff99 : 0x808080;

      const message = new MessageBuilder()
        .setTitle('📥 New User Deposit')
        .setColor(color)
        .setDescription(
          `
      **From:** ${senderUsername}
      **To Bot:** ${botUsername}
      **Total Pets:** ${totalItems}

      🐾 **Items:**
      ${formattedItems}
      `,
        )
        .setTimestamp()
        .setFooter('Deposit Logger');

      await this.botLoggerWebhook.send(message);
    } catch (error) {
      this.logger.warn(
        `Failed to send Discord notification of deposit: ${error.message}`,
      );
    }
  }
  async sendUserWithdrawToWebhook(
    botUsername: number,
    senderUsername: string,
    items: { petVariant: Variant[]; name: string }[],
  ): Promise<void> {
    try {
      const totalItems = items.length;

      const formattedItems = items
        .map((item) => {
          return `**${item.name}**  ${item.petVariant}`;
        })
        .join('\n');

      const color = totalItems > 3 ? 0x00ff99 : 0x808080;

      const message = new MessageBuilder()
        .setTitle('📤 User Withdrawal')
        .setColor(color)
        .setDescription(
          `
      **User:** ${senderUsername}
      **Bot:** ${botUsername}
      **Total Pets:** ${totalItems}

      🐾 **Withdrawn Pets:**
      ${formattedItems}
      `,
        )
        .setTimestamp()
        .setFooter('Withdrawal Logger');

      await this.botLoggerWebhook.send(message);
    } catch (error) {
      this.logger.warn(
        `Failed to send Discord notification of deposit: ${error.message}`,
      );
    }
  }
  async sendUserChatLog(
    username: string,
    content: string,
    role: string,
  ): Promise<void> {
    try {
      const color = 0x808080;

      const message = new MessageBuilder()
        .setTitle('💬 | New Chat Message')
        .setColor(color)
        .setDescription(
          `
      **Sender:** ${username}
      **Content:** ${content}
      **Role:** ${role}
      `,
        )
        .setTimestamp()
        .setFooter('Chat Logger');

      await this.chatLoggerWebhook.send(message);
    } catch (error) {
      this.logger.warn(
        `Failed to send Discord notification of deposit: ${error.message}`,
      );
    }
  }

  async sendTransactionLog({
    transactionId,
    username,
    amountCoin,
    amountCrypto,
    amountUsd,
    direction,
    status,
    provider,
    balanceAfter,
    additionalData
  }: {
    transactionId: string;
    username: string;
    amountCoin: number | string;
    amountCrypto: number | string;
    amountUsd: number | string;
    direction: 'IN' | 'OUT';
    status: string;
    provider: string;
    balanceAfter?: number;
    additionalData?: string;
  }): Promise<void> {
    try {
      const getStatusColor = (): number => {
        switch (status.toUpperCase()) {
          case 'COMPLETED':
            return direction === 'IN' ? 0x00ff00 : 0xff6b6b; // Green for deposits, Red for withdrawals
          case 'PENDING':
            return 0xffa500; // Orange
          case 'CONFIRMING':
            return 0xffeb3b; // Yellow
          case 'FAILED':
          case 'REJECTED':
            return 0xff0000; // Red
          case 'CANCELLED':
            return 0x808080; // Gray
          default:
            return 0x3498db; // Blue (default)
        }
      };

      // Determine emoji based on status
      const getStatusEmoji = (): string => {
        switch (status.toUpperCase()) {
          case 'COMPLETED':
            return '✅';
          case 'PENDING':
            return '⏳';
          case 'CONFIRMING':
            return '🔄';
          case 'FAILED':
          case 'REJECTED':
            return '❌';
          case 'CANCELLED':
            return '🚫';
          default:
            return '📝';
        }
      };

      // Direction emoji and title
      const directionEmoji = direction === 'IN' ? '📥' : '📤';
      const directionText = direction === 'IN' ? 'Deposit' : 'Withdrawal';

      // Format amounts with proper decimals
      const formatAmount = (amount: number | string, decimals: number = 2): string => {
        if (typeof amount === 'string') {
          return amount;
        }
        return amount.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
      };

      // Build the message
      const message = new MessageBuilder()
        .setTitle(
          `${directionEmoji} ${getStatusEmoji()} ${directionText} - ${status} - ${provider}`,
        )
        .setColor(getStatusColor())
        .setDescription(
          `**User:** \`${username}\`\n` +
            `**Transaction ID:** \`${transactionId}\`\n` +
            `**Provider:** \`${provider}\`\n` +
            `\n**Amounts:**\n` +
            `> 🪙 **COIN:** ${formatAmount(amountCoin, 2)}\n` +
            `> 💎 **Crypto:** ${formatAmount(amountCrypto, 8)}\n` +
            `> 💵 **USD:** $${formatAmount(amountUsd, 2)}\n` +
            `\n**Direction:** ${direction === 'IN' ? '➡️ Incoming' : '⬅️ Outgoing'}\n` +
            (balanceAfter !== undefined ? `**Balance After:** ${formatAmount(balanceAfter, 2)}\n` : '') +
            `**Status:** ${getStatusEmoji()} \`${status}\`` + 
            (additionalData ? `\n\n**Additional Info:**\n${additionalData}` : '')
        )
        .setTimestamp()
        .setFooter(`Transaction Logger • ${provider}`);

      // Add thumbnail based on direction and status
      if (direction === 'IN') {
        if (status.toUpperCase() === 'COMPLETED') {
          message.setThumbnail(
            'https://cdn-icons-png.flaticon.com/512/18937/18937635.png',
          );
        } else if (status.toUpperCase() === 'PENDING') {
          message.setThumbnail(
            'https://cdn-icons-png.flaticon.com/512/4844/4844499.png',
          );
        }
      } else {
        if (status.toUpperCase() === 'COMPLETED') {
          message.setThumbnail(
            'https://cdn-icons-png.flaticon.com/512/9652/9652666.png',
          );
        } else if (status.toUpperCase() === 'PENDING') {
          message.setThumbnail(
            'https://cdn-icons-png.flaticon.com/512/15337/15337642.png',
          );
        }
      }

      // Send to appropriate webhook based on direction
      const targetWebhook =
        direction === 'IN' ? this.depositsWebhook : this.withdrawalsWebhook;
        
      await targetWebhook.send(message);

      this.logger.log(
        `Discord notification sent: ${directionText} ${status} for user ${username} - $${formatAmount(amountUsd)}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to send Discord notification for transaction ${transactionId}: ${error.message}`,
      );
    }
  }
}