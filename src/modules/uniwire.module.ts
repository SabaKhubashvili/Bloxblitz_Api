import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { UNIWIRE_API_PORT, UNIWIRE_REPOSITORY } from '../application/uniwire/tokens/uniwire.tokens';
import { GetExchangeRatesUseCase } from '../application/uniwire/use-cases/get-exchange-rates.use-case';
import { GetTransactionConfirmationsUseCase } from '../application/uniwire/use-cases/get-transaction-confirmations.use-case';
import { CreateDepositInvoiceUseCase } from '../application/uniwire/use-cases/create-deposit-invoice.use-case';
import { CreatePayoutUseCase } from '../application/uniwire/use-cases/create-payout.use-case';
import { GetDepositAddressUseCase } from '../application/uniwire/use-cases/get-deposit-address.use-case';

import { UniwireApiRepository } from '../infrastructure/persistance/repositories/uniwire/uniwire-api.repository';
import { PrismaUniwireRepository } from '../infrastructure/persistance/repositories/uniwire/prisma-uniwire.repository';
import { PrismaModule } from '../infrastructure/persistance/prisma/prisma.module';
import { UniwireController } from '../presentation/http/public/uniwire/uniwire.controller';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from './auth.module';

@Module({

  imports: [HttpModule, ConfigModule, PrismaModule, AuthModule ],
  controllers: [UniwireController],
  providers: [
    { provide: UNIWIRE_API_PORT, useClass: UniwireApiRepository },
    { provide: UNIWIRE_REPOSITORY, useClass: PrismaUniwireRepository },
    GetExchangeRatesUseCase,

    

    GetTransactionConfirmationsUseCase,
    CreateDepositInvoiceUseCase,
    CreatePayoutUseCase,
    GetDepositAddressUseCase,

  ],
  exports: [
    GetExchangeRatesUseCase,
    GetTransactionConfirmationsUseCase,
    CreateDepositInvoiceUseCase,
    CreatePayoutUseCase,
    GetDepositAddressUseCase,
  ],
})
export class UniwireModule {}