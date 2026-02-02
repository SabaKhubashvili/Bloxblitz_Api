import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import {
  AssetType,
  PaymentProviders,
  ReferenceType,
  TransactionCategory,
  TransactionDirection,
  TransactionStatus,
} from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { RedisService } from 'src/provider/redis/redis.service';

@Injectable()
export class TransactionHistoryService {
  private readonly logger = new Logger(TransactionHistoryService.name);
  constructor(
    private readonly prismaService: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getTransactionHistory(
    username: string,
    page: number = 1,
    pageSize: number = 10,
  ) {
    try {
      const skip = (page - 1) * pageSize;
      const transactionHistory =
        await this.prismaService.transactionHistory.findMany({
          orderBy: {
            createdAt: 'desc',
          },
          where: {
            userUsername: username,
          },
          select: {
            id: true,
            direction: true,
            assetSymbol: true,
            assetType: true,
            category: true,
            coinAmountPaid: true,
            createdAt: true,
            status: true,
            provider: true,
          },
          take: pageSize,
          skip: skip,
        });

      const totalLength = await this.prismaService.$queryRaw<
        [{ count: number }]
      >`
            SELECT COUNT(*)::int as count
            FROM "TransactionHistory"
            WHERE "userUsername" = ${username}
        `;

      return {
        data: transactionHistory,
        total: totalLength[0]?.count || 0,
        totalPages: Math.ceil((totalLength[0]?.count || 0) / pageSize),
        currentPage: page,
        perPage: pageSize,
      };
    } catch (err) {
      this.logger.error(
        `Error fetching transaction history, ${JSON.stringify(err)}`,
      );
      if (err instanceof Error || err instanceof BadGatewayException) {
        console.error(`Error fetching transaction history: ${err.message}`);
      }
      throw new InternalServerErrorException(
        'Failed to fetch transaction history',
      );
    }
  }
  async addTransaction({
    username,
    direction,
    usdAmountPaid,
    cryptoAmountPaid,
    coinAmountPaid,
    assetSymbol,
    assetType,
    referenceId,
    status,
    balanceAfter,
    category,
    referenceType,
    provider,
  }: {
    username: string;
    direction: TransactionDirection;
    category: TransactionCategory;
    usdAmountPaid: number;
    cryptoAmountPaid: number;
    coinAmountPaid: number;
    assetSymbol: string;
    assetType: AssetType;
    referenceId: string;
    status: TransactionStatus;
    balanceAfter: number;
    referenceType: ReferenceType;
    provider: PaymentProviders;
  }) {
    try {
      const transaction = await this.prismaService.transactionHistory.create({
        data: {
          userUsername: username,
          direction,
          usdAmountPaid,
          cryptoAmountPaid,
          coinAmountPaid,
          assetSymbol,
          assetType,
          status,
          category,
          balanceAfter,
          referenceType,
          referenceId,
          provider,
        },
      });
      return transaction;
    } catch (err) {
      this.logger.error(`Error adding transaction, ${JSON.stringify(err)}`);
      throw new InternalServerErrorException('Failed to add transaction');
    }
  }
}
