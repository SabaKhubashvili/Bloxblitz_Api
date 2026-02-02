import { Controller, Get, Param, Request, UseGuards } from '@nestjs/common';
import { type AuthenticatedRequest, JwtAuthGuard } from 'src/middleware/jwt.middleware';
import { TransactionHistoryService } from './transaction-history.service';
import { GetTransactionHistoryDto } from './dto/get-transaction-history.dto';
import { PaymentProviders } from '@prisma/client';

@Controller('/user/history/transactions')
export class TransactionHistoryController {
  constructor(private readonly transactionHistoryService: TransactionHistoryService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getTransactionHistory(@Request() req:AuthenticatedRequest, @Param() params:GetTransactionHistoryDto) {
    const username = req.user.username;
    const history = await this.transactionHistoryService.getTransactionHistory(username,params.page);
    const safeHistory = history.data.map(tx => ({
      id: tx.id,
      category: tx.category,
      direction: tx.direction,
      status: tx.status,
      amount: tx.coinAmountPaid,
      assetType: tx.assetType,
      assetSymbol: tx.assetSymbol,
      createdAt: tx.createdAt,
      provider: tx.provider === PaymentProviders.UNIWIRE ? "CRYPTO" : tx.provider
    }))
    
    return  {
      data: safeHistory,
      total: history.total,
      totalPages: history.totalPages,
      currentPage: history.currentPage,
      perPage: history.perPage
    }
  }
}
