import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// ── Tokens ────────────────────────────────────────────────────────────────────
import { TRANSACTION_HISTORY_REPOSITORY } from '../../application/user/transactions/tokens/transaction.tokens';

// ── Application (use-cases) ───────────────────────────────────────────────────
import { GetUserTransactionHistoryUseCase } from '../../application/user/transactions/use-cases/get-user-transaction-history.use-case';
import { GetTransactionByIdUseCase }        from '../../application/user/transactions/use-cases/get-transaction-by-id.use-case';
import { CreateTransactionUseCase }         from '../../application/user/transactions/use-cases/create-transaction.use-case';

// ── Infrastructure (port implementations) ────────────────────────────────────
import { PrismaTransactionHistoryRepository } from '../../infrastructure/persistance/repositories/user/transaction-history.repository';

// ── Presentation ──────────────────────────────────────────────────────────────
import { TransactionController } from '../../presentation/http/public/user/transactions/transaction.controller';

// ── Guards ────────────────────────────────────────────────────────────────────
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { AuthModule } from '../auth.module';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [TransactionController],
  providers: [
    // Guards
    JwtAuthGuard,

    // Use-cases
    GetUserTransactionHistoryUseCase,
    GetTransactionByIdUseCase,
    // CreateTransactionUseCase is internal — exported so other modules
    // (CryptoDepositModule, KinguinModule, etc.) can call it directly.
    CreateTransactionUseCase,

    // Port → Implementation binding
    { provide: TRANSACTION_HISTORY_REPOSITORY, useClass: PrismaTransactionHistoryRepository },
  ],
  exports: [
    // Exported so sibling modules can inject CreateTransactionUseCase
    // without re-declaring its providers.
    CreateTransactionUseCase,
    GetUserTransactionHistoryUseCase,
  ],
})
export class TransactionModule {}
