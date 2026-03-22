import { Module } from '@nestjs/common';

import { ListCasesUseCase } from '../../application/game/case/use-cases/list-cases.use-case';
import { GetCaseBySlugUseCase } from '../../application/game/case/use-cases/get-case-by-slug.use-case';
import { GetCaseMetadataUseCase } from '../../application/game/case/use-cases/get-case-metadata.use-case';
import { OpenCaseUseCase } from '../../application/game/case/use-cases/open-case.use-case';
import { CreateCaseUseCase } from '../../application/game/case/use-cases/create-case.use-case';
import { CaseFairnessDomainService } from '../../domain/game/case/services/case-fairness.domain-service';
import { CaseMetadataDomainService } from '../../domain/game/case/services/case-metadata.domain-service';

import { PrismaCaseRepository } from '../../infrastructure/persistance/repositories/game/case.repository';
import { CaseListCacheAdapter } from '../../infrastructure/cache/adapters/case-list-cache.adapter';
import { CaseDetailCacheAdapter } from '../../infrastructure/cache/adapters/case-detail-cache.adapter';
import { UserSeedRepository } from '../../infrastructure/persistance/repositories/user/user-seed.repository';
import { DiceBalanceLedgerAdapter } from '../../infrastructure/cache/adapters/dice-balance-ledger.adapter';

import {
  CASE_REPOSITORY,
  CASE_LIST_CACHE,
  CASE_DETAIL_CACHE,
} from '../../application/game/case/tokens/case.tokens';
import {
  USER_SEED_REPOSITORY,
  DICE_BALANCE_LEDGER,
} from '../../application/game/dice/tokens/dice.tokens';

import { CasesController } from '../../presentation/http/public/game/cases/cases.controller';
import { JwtAuthGuard } from '../../shared/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { AuthModule } from '../auth.module';
import { ProvablyFairModule } from '../user/provably-fair.module';

@Module({
  imports: [AuthModule, ProvablyFairModule],
  controllers: [CasesController],
  providers: [
    ListCasesUseCase,
    GetCaseBySlugUseCase,
    GetCaseMetadataUseCase,
    CaseMetadataDomainService,
    OpenCaseUseCase,
    CreateCaseUseCase,
    CaseFairnessDomainService,
    JwtAuthGuard,
    RolesGuard,
    { provide: CASE_REPOSITORY, useClass: PrismaCaseRepository },
    { provide: CASE_LIST_CACHE, useClass: CaseListCacheAdapter },
    { provide: CASE_DETAIL_CACHE, useClass: CaseDetailCacheAdapter },
    { provide: USER_SEED_REPOSITORY, useClass: UserSeedRepository },
    { provide: DICE_BALANCE_LEDGER, useClass: DiceBalanceLedgerAdapter },
  ],
  exports: [CASE_LIST_CACHE, ListCasesUseCase, GetCaseBySlugUseCase, OpenCaseUseCase],
})
export class CaseModule {}
