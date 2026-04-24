import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
  UNIWIRE_API_PORT,
  UNIWIRE_REPOSITORY,
} from '../application/uniwire/tokens/uniwire.tokens';
import { CreateDepositInvoiceUseCase } from '../application/uniwire/use-cases/create-deposit-invoice.use-case';
import { CreatePayoutUseCase } from '../application/uniwire/use-cases/create-payout.use-case';
import { GetDepositAddressUseCase } from '../application/uniwire/use-cases/get-deposit-address.use-case';
import { GetExchangeRatesUseCase } from '../application/uniwire/use-cases/get-exchange-rates.use-case';
import { GetTransactionConfirmationsUseCase } from '../application/uniwire/use-cases/get-transaction-confirmations.use-case';
import { KinguinModule } from './kinguin.module';

import { HandleTransactionCompletedUseCase } from 'src/application/uniwire/use-cases/handle-transaction-completed.use-case';
import { HandleTransactionConfirmedUseCase } from 'src/application/uniwire/use-cases/handle-transaction-confirmed.use-case';
import { HandleTransactionPendingUseCase } from 'src/application/uniwire/use-cases/handle-transaction-pending.use-case';
import { DecrementUserBalanceUseCase } from 'src/application/balance/use-cases/decrement-user-balance.use-case';
import { IncrementUserBalanceUseCase } from 'src/application/balance/use-cases/increment-user-balance.use-case';
import { USER_BALANCE_REPOSITORY } from 'src/application/balance/tokens/balance.tokens';
import { BALANCE_REPOSITORY } from 'src/application/user/tokens/user.tokens';
import { PrismaModule } from '../infrastructure/persistance/prisma/prisma.module';
import { PrismaUniwireRepository } from '../infrastructure/persistance/repositories/uniwire/prisma-uniwire.repository';
import { UniwireApiRepository } from '../infrastructure/persistance/repositories/uniwire/uniwire-api.repository';
import { PrismaBalanceRepository } from 'src/infrastructure/persistance/repositories/user/balance.repository';
import { UserBalanceRedisRepository } from 'src/infrastructure/cache/adapters/user-balance-redis.repository';
import { UniwireController } from '../presentation/http/public/uniwire/uniwire.controller';
import { AuthModule } from './auth.module';

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, KinguinModule],
  controllers: [UniwireController],
  providers: [
    { provide: UNIWIRE_API_PORT, useClass: UniwireApiRepository },
    { provide: UNIWIRE_REPOSITORY, useClass: PrismaUniwireRepository },
    { provide: BALANCE_REPOSITORY, useClass: PrismaBalanceRepository },
    { provide: USER_BALANCE_REPOSITORY, useClass: UserBalanceRedisRepository },
    GetExchangeRatesUseCase,
    DecrementUserBalanceUseCase,
    IncrementUserBalanceUseCase,

    GetTransactionConfirmationsUseCase,
    CreateDepositInvoiceUseCase,
    CreatePayoutUseCase,
    GetDepositAddressUseCase,
    HandleTransactionPendingUseCase,
    HandleTransactionConfirmedUseCase,
    HandleTransactionCompletedUseCase,
  ],
  exports: [
    UNIWIRE_API_PORT,
    GetExchangeRatesUseCase,
    GetTransactionConfirmationsUseCase,
    CreateDepositInvoiceUseCase,
    CreatePayoutUseCase,
    GetDepositAddressUseCase,
  ],
})
export class UniwireModule {}
